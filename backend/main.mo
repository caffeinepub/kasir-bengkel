import Text "mo:core/Text";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Set "mo:core/Set";
import Order "mo:core/Order";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import MixinStorage "blob-storage/Mixin";
import Storage "blob-storage/Storage";
import Migration "migration";

(with migration = Migration.run)
actor {
  include MixinStorage();

  //////////////////////
  // Type Definitions //
  //////////////////////

  public type ProductType = {
    #goods;
    #service;
  };

  public type InventoryItem = {
    id : Nat;
    name : Text;
    sellingPrice : Nat;
    purchasePrice : Nat;
    quantity : ?Nat; // null if not applicable (services)
    productType : ProductType;
  };

  public type TransactionItem = {
    id : Nat;
    name : Text;
    price : Nat;
    quantity : Nat;
    itemType : ProductType;
  };

  public type Transaction = {
    id : Nat;
    timestamp : Time.Time;
    items : [TransactionItem];
    total : Nat;
    customerName : Text;
    vehicleInfo : Text;
  };

  public type ShopSettings = {
    logo : ?Storage.ExternalBlob;
    shopName : Text;
    address : Text;
    phoneNumber : Text;
    thankYouMessage : Text;
  };

  public type DailyReport = {
    day : Time.Time;
    totalRevenue : Nat;
    transactionCount : Nat;
  };

  public type MonthlyReport = {
    month : Time.Time;
    totalRevenue : Nat;
    transactionCount : Nat;
  };

  module Transaction {
    public func compare(transaction1 : Transaction, transaction2 : Transaction) : Order.Order {
      Nat.compare(transaction1.id, transaction2.id);
    };
  };

  module InventoryItem {
    public func compare(item1 : InventoryItem, item2 : InventoryItem) : Order.Order {
      Nat.compare(item1.id, item2.id);
    };
  };

  /////////////////
  // STATE       //
  /////////////////

  var nextTransactionId : Nat = 0;
  var persistentSettings : ?ShopSettings = null;

  let persistentTransactions = Map.empty<Nat, Transaction>();
  let persistentCustomers = Set.empty<Text>();
  let persistentInventory = Map.empty<Nat, InventoryItem>();

  /////////////////////////////////
  // SHOP SETTINGS MANAGEMENT    //
  /////////////////////////////////

  public shared ({ caller }) func uploadLogo(file : Storage.ExternalBlob) : async () {
    persistentSettings := switch (persistentSettings) {
      case (null) {
        ?{
          logo = ?file;
          shopName = "";
          address = "";
          phoneNumber = "";
          thankYouMessage = "";
        };
      };
      case (?existingSettings) {
        ?{ existingSettings with logo = ?file };
      };
    };
  };

  public shared ({ caller }) func updateShopSettings(shopName : Text, address : Text, phoneNumber : Text, thankYouMessage : Text) : async () {
    persistentSettings := switch (persistentSettings) {
      case (null) {
        ?{
          logo = null;
          shopName;
          address;
          phoneNumber;
          thankYouMessage;
        };
      };
      case (?existingSettings) {
        ?{
          existingSettings with
          shopName;
          address;
          phoneNumber;
          thankYouMessage;
        };
      };
    };
  };

  public query ({ caller }) func getShopSettings() : async ShopSettings {
    switch (persistentSettings) {
      case (null) { Runtime.trap("Shop settings not found") };
      case (?settings) { settings };
    };
  };

  /////////////////////////////////
  // INVENTORY MANAGEMENT        //
  /////////////////////////////////

  public shared ({ caller }) func addInventoryItem(id : Nat, name : Text, sellingPrice : Nat, purchasePrice : Nat, quantity : ?Nat, productType : ProductType) : async () {
    if (name == "") {
      Runtime.trap("Name cannot be empty");
    };

    if (persistentInventory.containsKey(id)) {
      Runtime.trap("ID " # id.toText() # " already exists.");
    };

    switch (productType) {
      case (#goods) {
        switch (quantity) {
          case (null) { Runtime.trap("Quantity required for goods") };
          case (?q) {
            if (q == 0) { Runtime.trap("Quantity must be greater than 0") };
          };
        };
      };
      case (#service) {
        if (quantity != null) { Runtime.trap("Quantity should not be provided for services") };
      };
    };

    let item : InventoryItem = {
      id;
      name;
      sellingPrice;
      purchasePrice;
      quantity;
      productType;
    };

    persistentInventory.add(id, item);
  };

  public shared ({ caller }) func updateInventoryItemQuantity(itemId : Nat, newQuantity : Nat) : async () {
    switch (persistentInventory.get(itemId)) {
      case (null) { Runtime.trap("Inventory item not found") };
      case (?item) {
        if (item.productType == #goods) {
          let updatedItem = { item with quantity = ?newQuantity };
          persistentInventory.add(itemId, updatedItem);
        } else {
          Runtime.trap("Cannot update quantity for services");
        };
      };
    };
  };

  public shared ({ caller }) func deleteInventoryItem(id : Nat) : async () {
    if (not persistentInventory.containsKey(id)) { Runtime.trap("Inventory item ID does not exist.") };
    persistentInventory.remove(id);
  };

  public query ({ caller }) func getAllInventoryItems() : async [InventoryItem] {
    persistentInventory.values().toArray().sort();
  };

  public query ({ caller }) func getInventoryItem(id : Nat) : async ?InventoryItem {
    persistentInventory.get(id);
  };

  /////////////////////////////////
  // TRANSACTION MANAGEMENT      //
  /////////////////////////////////
  public shared ({ caller }) func createTransaction(items : [TransactionItem], total : Nat, customerName : Text, vehicleInfo : Text) : async Nat {
    let id = nextTransactionId;
    nextTransactionId += 1;

    let transaction = {
      id;
      timestamp = Time.now();
      items;
      total;
      customerName;
      vehicleInfo;
    };

    persistentTransactions.add(id, transaction);
    id;
  };

  public query ({ caller }) func getTransaction(id : Nat) : async ?Transaction {
    persistentTransactions.get(id);
  };

  public shared ({ caller }) func deleteTransaction(id : Nat) : async () {
    if (not persistentTransactions.containsKey(id)) { Runtime.trap("Transaction ID does not exist.") };
    persistentTransactions.remove(id);
  };

  public query ({ caller }) func getAllTransactions() : async [Transaction] {
    persistentTransactions.values().toArray().sort();
  };

  /////////////////////////////////
  // CUSTOMER MANAGEMENT         //
  /////////////////////////////////

  public query ({ caller }) func getAllCustomers() : async [Text] {
    persistentCustomers.toArray();
  };

  public shared ({ caller }) func addCustomer(customer : Text) : async () {
    persistentCustomers.add(customer);
  };

  public shared ({ caller }) func deleteCustomer(customer : Text) : async () {
    if (not persistentCustomers.contains(customer)) {
      Runtime.trap("Customer does not exist");
    };
    persistentCustomers.remove(customer);
  };

  /////////////////////
  // REPORTS          //
  /////////////////////

  public query ({ caller }) func getTransactionsByCustomer(customer : Text) : async [Transaction] {
    persistentTransactions.values().toArray().sort().filter(
      func(transaction) {
        transaction.customerName == customer;
      }
    );
  };

  public query ({ caller }) func getTransactionsByMonth(monthTimestamp : Time.Time) : async [Transaction] {
    persistentTransactions.values().toArray().sort().filter(
      func(transaction) {
        isSameMonth(transaction.timestamp, monthTimestamp);
      }
    );
  };

  public query ({ caller }) func getDailyReport(day : Time.Time) : async DailyReport {
    let daySeconds = day / 1_000_000_000;
    var dailyTotalRevenue = 0;
    var dailyTransactionCount = 0;

    for ((_, transaction) in persistentTransactions.entries()) {
      let transactionDaySeconds = transaction.timestamp / 1_000_000_000;
      if (transactionDaySeconds == daySeconds) {
        dailyTotalRevenue += transaction.total;
        dailyTransactionCount += 1;
      };
    };

    {
      day;
      totalRevenue = dailyTotalRevenue;
      transactionCount = dailyTransactionCount;
    };
  };

  public query ({ caller }) func getMonthlyReport(month : Time.Time) : async MonthlyReport {
    var monthlyTotalRevenue = 0;
    var monthlyTransactionCount = 0;

    for ((_, transaction) in persistentTransactions.entries()) {
      if (isSameMonth(transaction.timestamp, month)) {
        monthlyTotalRevenue += transaction.total;
        monthlyTransactionCount += 1;
      };
    };

    {
      month;
      totalRevenue = monthlyTotalRevenue;
      transactionCount = monthlyTransactionCount;
    };
  };

  public query ({ caller }) func getTopSellingItems(count : Nat) : async [(Text, Nat)] {
    // Create a map for item counts
    let itemCounts = Map.empty<Text, Nat>();

    // Count item sales
    for ((_, transaction) in persistentTransactions.entries()) {
      for (item in transaction.items.values()) {
        switch (itemCounts.get(item.name)) {
          case (null) {
            itemCounts.add(item.name, item.quantity);
          };
          case (?quantity) {
            itemCounts.add(item.name, quantity + item.quantity);
          };
        };
      };
    };

    let allItems = itemCounts.toArray();
    if (allItems.size() == 0) { return [] };

    let sorted = allItems.sort(
      func(a, b) {
        Nat.compare(b.1, a.1);
      }
    );

    let takeCount = if (count > sorted.size()) {
      sorted.size();
    } else { count };

    sorted.sliceToArray(0, takeCount);
  };

  public query ({ caller }) func calculateProfitLoss(startTime : Time.Time, endTime : Time.Time) : async Nat {
    var totalProfit : Nat = 0;

    let transactions = persistentTransactions.values().toArray().sort();

    for (transaction in transactions.values()) {
      if (transaction.timestamp >= startTime and transaction.timestamp <= endTime) {
        for (item in transaction.items.values()) {
          switch (persistentInventory.get(item.id)) {
            case (?inventoryItem) {
              if (inventoryItem.sellingPrice >= inventoryItem.purchasePrice) {
                totalProfit += (inventoryItem.sellingPrice - inventoryItem.purchasePrice) * item.quantity;
              };
            };
            case (null) {};
          };
        };
      };
    };

    totalProfit;
  };

  /////////////////////
  // DATE UTILITIES
  /////////////////////

  func isSameMonth(timestamp1 : Time.Time, timestamp2 : Time.Time) : Bool {
    let dt1 = timestamp1 / 1_000_000_000;
    let dt2 = timestamp2 / 1_000_000_000;
    dt1 >= dt2 and dt1 < (dt2 + 30 * 24 * 60 * 60);
  };
};
