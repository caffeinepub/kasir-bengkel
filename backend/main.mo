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

actor {
  include MixinStorage();

  //////////////////////
  // Type Definitions //
  //////////////////////

  public type ItemType = {
    #service;
    #product;
  };

  public type TransactionItem = {
    id : Nat;
    name : Text;
    price : Nat;
    quantity : Nat;
    itemType : ItemType;
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

  /////////////////
  // STATE       //
  /////////////////

  var nextTransactionId : Nat = 0;
  var persistentSettings : ?ShopSettings = null;

  let persistentTransactions = Map.empty<Nat, Transaction>();
  let persistentCustomers = Set.empty<Text>();

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
  // PRODUCT & SERVICE MANAGEMENT //
  /////////////////////////////////

  public type Product = {
    id : Nat;
    name : Text;
    price : Nat;
    stock : Nat;
  };

  public type Service = {
    id : Nat;
    name : Text;
    price : Nat;
    description : Text;
  };

  module Product {
    public func compare(product1 : Product, product2 : Product) : Order.Order {
      Nat.compare(product1.id, product2.id);
    };
  };

  module Service {
    public func compare(service1 : Service, service2 : Service) : Order.Order {
      Nat.compare(service1.id, service2.id);
    };
  };

  // PERSISTENT STORAGE
  let persistentProducts = Map.empty<Nat, Product>();
  let persistentServices = Map.empty<Nat, Service>();

  public shared ({ caller }) func addProduct(id : Nat, name : Text, price : Nat, stock : Nat) : async () {
    if (name == "") {
      Runtime.trap("Name cannot be empty");
    };

    if (stock == 0) {
      Runtime.trap("Stock must be greater than 0");
    };

    if (persistentProducts.containsKey(id)) {
      Runtime.trap("ID " # id.toText() # " already exists.");
    };

    let product : Product = {
      id;
      name;
      price;
      stock;
    };

    persistentProducts.add(id, product);
  };

  public shared ({ caller }) func addService(id : Nat, name : Text, price : Nat, description : Text) : async () {
    if (name == "") {
      Runtime.trap("Name cannot be empty");
    };

    if (persistentServices.containsKey(id)) {
      Runtime.trap("ID " # id.toText() # " already exists.");
    };

    let service : Service = {
      id;
      name;
      price;
      description;
    };

    persistentServices.add(id, service);
  };

  public shared ({ caller }) func updateProductStock(productId : Nat, newStock : Nat) : async () {
    switch (persistentProducts.get(productId)) {
      case (null) { Runtime.trap("Product not found") };
      case (?product) {
        let updatedProduct = { product with stock = newStock };
        persistentProducts.add(productId, updatedProduct);
      };
    };
  };

  public shared ({ caller }) func deleteService(id : Nat) : async () {
    if (not persistentServices.containsKey(id)) { Runtime.trap("Service ID does not exist.") };
    persistentServices.remove(id);
  };

  public shared ({ caller }) func deleteProduct(id : Nat) : async () {
    if (not persistentProducts.containsKey(id)) { Runtime.trap("Product ID does not exist.") };
    persistentProducts.remove(id);
  };

  public query ({ caller }) func getAllProducts() : async [Product] {
    persistentProducts.values().toArray().sort();
  };

  public query ({ caller }) func getAllServices() : async [Service] {
    persistentServices.values().toArray().sort();
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

  /////////////////////
  // DATE UTILITIES
  /////////////////////

  func isSameMonth(timestamp1 : Time.Time, timestamp2 : Time.Time) : Bool {
    let dt1 = timestamp1 / 1_000_000_000;
    let dt2 = timestamp2 / 1_000_000_000;
    dt1 >= dt2 and dt1 < (dt2 + 30 * 24 * 60 * 60);
  };
};
