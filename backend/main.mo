import Text "mo:core/Text";
import Map "mo:core/Map";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Nat "mo:core/Nat";
import Set "mo:core/Set";
import Order "mo:core/Order";
import MixinStorage "blob-storage/Mixin";
import Storage "blob-storage/Storage";

import Runtime "mo:core/Runtime";

// Apply data migration function on upgrades:

actor {
  include MixinStorage();

  /////////////////////////////////////////////////////////////////////////////
  //////////////////////            Types              ////////////////////////
  /////////////////////////////////////////////////////////////////////////////

  public type ItemKind = {
    #service;
    #goods;
  };

  public type Price = {
    id : Nat;
    name : Text;
    amount : Nat; // price in smallest currency (e.g. cents)
    description : Text;
    kind : ItemKind;
  };

  public type InventoryItem = {
    id : Text;
    name : Text;
    sellingPrice : Nat;
    purchasePrice : Nat;
    quantity : ?Nat;
    kind : ItemKind;
  };

  // "barang" -> goods
  // "jasa" -> services
  // Backend idea: Use type system to ensure that services don't have quantity. Queries can be "all services", "all goods", etc.
  // When computing revenue, only count goods that have purchase price.

  public type TransactionItem = {
    id : Text;
    name : Text;
    price : Nat;
    quantity : Nat;
    itemType : ItemKind;
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

  module Price {
    public func compare(p1 : Price, p2 : Price) : Order.Order {
      Nat.compare(p1.id, p2.id);
    };
  };

  /////////////////////////////////////////////////////////////////////////////
  //////////////////////         State              ///////////////////////////
  /////////////////////////////////////////////////////////////////////////////

  var persistentNextTransactionId = 0;
  var persistentSettings : ?ShopSettings = null;

  // Maps for persistent storage
  let persistentCustomers = Set.empty<Text>();
  let persistentTransactions = Map.empty<Nat, Transaction>();
  let persistentInventory = Map.empty<Text, InventoryItem>();

  /////////////////////////////////////////////////////////////////////////////
  //////////////////////        Shop Settings      ////////////////////////////
  /////////////////////////////////////////////////////////////////////////////

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

  public shared ({ caller }) func updatePersistentSettings(shopName : Text, address : Text, phoneNumber : Text, thankYouMessage : Text) : async () {
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

  public query ({ caller }) func getPersistentSettings() : async ShopSettings {
    switch (persistentSettings) {
      case (null) { Runtime.trap("Shop settings not found") };
      case (?settings) { settings };
    };
  };

  /////////////////////////////////////////////////////////////////////////////
  //////////////////////        Inventory            //////////////////////////
  /////////////////////////////////////////////////////////////////////////////

  public shared ({ caller }) func addInventoryItem(id : Text, name : Text, sellingPrice : Nat, purchasePrice : Nat, quantity : ?Nat, kind : ItemKind) : async () {
    if (name == "") {
      Runtime.trap("Name cannot be empty");
    };

    if (persistentInventory.containsKey(id)) {
      Runtime.trap("ID " # id # " already exists.");
    };

    switch (kind) {
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
      kind;
    };

    persistentInventory.add(id, item);
  };

  public shared ({ caller }) func updateInventoryItemQuantity(itemId : Text, newQuantity : Nat) : async () {
    switch (persistentInventory.get(itemId)) {
      case (null) { Runtime.trap("Inventory item not found") };
      case (?item) {
        if (item.kind == #goods) {
          let updatedItem = { item with quantity = ?newQuantity };
          persistentInventory.add(itemId, updatedItem);
        } else {
          Runtime.trap("Cannot update quantity for services");
        };
      };
    };
  };

  public shared ({ caller }) func deleteInventoryItem(id : Text) : async () {
    if (not persistentInventory.containsKey(id)) { Runtime.trap("Inventory item ID does not exist.") };
    persistentInventory.remove(id);
  };

  public query ({ caller }) func getAllInventoryItems() : async [InventoryItem] {
    persistentInventory.values().toArray();
  };

  public query ({ caller }) func getInventoryItem(id : Text) : async ?InventoryItem {
    persistentInventory.get(id);
  };

  /////////////////////////////////////////////////////////////////////////////
  //////////////////////        Transactions          /////////////////////////
  /////////////////////////////////////////////////////////////////////////////

  public shared ({ caller }) func createTransaction(items : [TransactionItem], total : Nat, customerName : Text, vehicleInfo : Text) : async Nat {
    let id = persistentNextTransactionId;
    persistentNextTransactionId += 1;

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
    persistentTransactions.values().toArray();
  };

  /////////////////////////////////////////////////////////////////////////////
  //////////////////////        Customers              ////////////////////////
  /////////////////////////////////////////////////////////////////////////////

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

  /////////////////////////////////////////////////////////////////////////////
  //////////////////////        Reports                 ///////////////////////
  /////////////////////////////////////////////////////////////////////////////

  public query ({ caller }) func getTransactionsByCustomer(customer : Text) : async [Transaction] {
    persistentTransactions.values().toArray().filter(
      func(transaction) {
        transaction.customerName == customer;
      }
    );
  };

  public query ({ caller }) func getTransactionsByMonth(monthTimestamp : Time.Time) : async [Transaction] {
    persistentTransactions.values().toArray().filter(
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
    let itemCounts = Map.empty<Text, Nat>();

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

    let transactions = persistentTransactions.values().toArray();

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

  /////////////////////////////////////////////////////////////////////////////
  //////////////////////        Date Utilities         ////////////////////////
  /////////////////////////////////////////////////////////////////////////////

  func isSameMonth(timestamp1 : Time.Time, timestamp2 : Time.Time) : Bool {
    let dt1 = timestamp1 / 1_000_000_000;
    let dt2 = timestamp2 / 1_000_000_000;
    dt1 >= dt2 and dt1 < (dt2 + 30 * 24 * 60 * 60);
  };
};
