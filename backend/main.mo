import Text "mo:core/Text";
import Map "mo:core/Map";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Nat "mo:core/Nat";
import Set "mo:core/Set";
import Int "mo:core/Int";
import Order "mo:core/Order";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import MixinStorage "blob-storage/Mixin";
import Storage "blob-storage/Storage";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  include MixinStorage();

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  /////////////////////////////////////////////////////////////////////////////
  //////////////////////            Types              ////////////////////////
  /////////////////////////////////////////////////////////////////////////////

  public type ItemKind = {
    #service;
    #goods;
  };

  public type InventoryItem = {
    id : Text;
    name : Text;
    sellingPrice : Nat;
    purchasePrice : Nat;
    quantity : ?Nat;
    kind : ItemKind;
  };

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
    customerPhone : Text;
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

  // WorkOrder Types
  public type WorkOrderStatus = { #pending; #inProgress; #done; #cancelled };
  public type WorkOrder = {
    id : Text;
    workOrderNumber : Text;
    customerName : Text;
    customerPhone : Text;
    vehicles : [Text];
    dateIn : Int;
    dateOut : ?Int;
    problemDescription : Text;
    repairAction : Text;
    technician : Text;
    status : WorkOrderStatus;
  };

  // User Profile Type
  public type UserProfile = {
    name : Text;
  };

  /////////////////////////////////////////////////////////////////////////////
  //////////////////////         State              ///////////////////////////
  /////////////////////////////////////////////////////////////////////////////

  var persistentNextTransactionId = 0;
  var persistentNextWorkOrderId = 0;
  var persistentNextWorkOrderNumber = 0;
  var persistentSettings : ?ShopSettings = null;

  let persistentCustomers = Set.empty<Text>();
  let persistentTransactions = Map.empty<Nat, Transaction>();
  var persistentInventory = Map.empty<Text, InventoryItem>();
  var persistentWorkOrders = Map.empty<Text, WorkOrder>();
  let userProfiles = Map.empty<Principal, UserProfile>();

  /////////////////////////////////////////////////////////////////////////////
  //////////////////////        User Profiles          ////////////////////////
  /////////////////////////////////////////////////////////////////////////////

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can get profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  /////////////////////////////////////////////////////////////////////////////
  //////////////////////        Shop Settings      ////////////////////////////
  /////////////////////////////////////////////////////////////////////////////

  public shared ({ caller }) func uploadLogo(file : Storage.ExternalBlob) : async () {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can upload logo");
    };
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
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can update shop settings");
    };
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

  public query ({ caller }) func getPersistentSettings() : async ?ShopSettings {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view shop settings");
    };
    persistentSettings;
  };

  /////////////////////////////////////////////////////////////////////////////
  //////////////////////        Inventory            //////////////////////////
  /////////////////////////////////////////////////////////////////////////////

  public shared ({ caller }) func addInventoryItem(id : Text, name : Text, sellingPrice : Nat, purchasePrice : Nat, quantity : ?Nat, kind : ItemKind) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can add inventory items");
    };
    if (name == "") {
      return;
    };

    if (persistentInventory.containsKey(id)) {
      return;
    };

    switch (kind) {
      case (#goods) {
        switch (quantity) {
          case (null) { return };
          case (?q) {
            if (q == 0) { return };
          };
        };
      };
      case (#service) {
        if (quantity != null) { return };
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
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can update inventory item quantity");
    };
    switch (persistentInventory.get(itemId)) {
      case (null) { return };
      case (?item) {
        if (item.kind == #goods) {
          let updatedItem = { item with quantity = ?newQuantity };
          persistentInventory.add(itemId, updatedItem);
        } else {
          return;
        };
      };
    };
  };

  public shared ({ caller }) func updateAllItems(items : [InventoryItem]) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can update inventory items");
    };
    for (item in items.values()) {
      persistentInventory.add(item.id, item);
    };
  };

  public shared ({ caller }) func deleteInventoryItem(id : Text) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can delete inventory items");
    };
    if (not persistentInventory.containsKey(id)) { return };
    persistentInventory.remove(id);
  };

  public query ({ caller }) func getAllInventoryItems() : async [InventoryItem] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view inventory items");
    };
    persistentInventory.values().toArray();
  };

  public query ({ caller }) func getInventoryItem(id : Text) : async ?InventoryItem {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view inventory items");
    };
    persistentInventory.get(id);
  };

  /////////////////////////////////////////////////////////////////////////////
  //////////////////////        Transactions          /////////////////////////
  /////////////////////////////////////////////////////////////////////////////

  public shared ({ caller }) func createTransaction(items : [TransactionItem], total : Nat, customerName : Text, customerPhone : Text, vehicleInfo : Text) : async Nat {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can create transactions");
    };
    let id = persistentNextTransactionId;
    persistentNextTransactionId += 1;

    let transaction = {
      id;
      timestamp = Time.now();
      items;
      total;
      customerName;
      customerPhone;
      vehicleInfo;
    };

    persistentTransactions.add(id, transaction);
    id;
  };

  public query ({ caller }) func getTransaction(id : Nat) : async ?Transaction {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view transactions");
    };
    persistentTransactions.get(id);
  };

  public query ({ caller }) func getAllTransactions() : async [Transaction] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view transactions");
    };
    persistentTransactions.values().toArray();
  };

  /////////////////////////////////////////////////////////////////////////////
  //////////////////////        Customers              ////////////////////////
  /////////////////////////////////////////////////////////////////////////////

  public query ({ caller }) func getAllCustomers() : async [Text] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view customers");
    };
    persistentCustomers.toArray();
  };

  public shared ({ caller }) func addCustomer(customer : Text) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can add customers");
    };
    persistentCustomers.add(customer);
  };

  public shared ({ caller }) func deleteCustomer(customer : Text) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can delete customers");
    };
    if (not persistentCustomers.contains(customer)) {
      return;
    };
    persistentCustomers.remove(customer);
  };

  /////////////////////////////////////////////////////////////////////////////
  //////////////////////        Reports                 ///////////////////////
  /////////////////////////////////////////////////////////////////////////////

  public query ({ caller }) func getTransactionsByCustomer(customer : Text) : async [Transaction] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view reports");
    };
    persistentTransactions.values().toArray().filter(
      func(transaction) {
        transaction.customerName == customer;
      }
    );
  };

  public query ({ caller }) func getTransactionsByMonth(monthTimestamp : Time.Time) : async [Transaction] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view reports");
    };
    persistentTransactions.values().toArray().filter(
      func(transaction) {
        isSameMonth(transaction.timestamp, monthTimestamp);
      }
    );
  };

  public query ({ caller }) func getDailyReport(day : Time.Time) : async DailyReport {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view reports");
    };
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
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view reports");
    };
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
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view reports");
    };
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
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view reports");
    };
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

  /////////////////////////////////////////////////////////////////////////////
  //////////////////////        Work Order Logic        ///////////////////////
  /////////////////////////////////////////////////////////////////////////////

  public query ({ caller }) func listWorkOrders() : async [WorkOrder] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can list work orders");
    };
    persistentWorkOrders.toArray().map(func((_, workOrder)) { workOrder }).reverse();
  };

  public query ({ caller }) func getWorkOrder(id : Text) : async ?WorkOrder {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view work orders");
    };
    persistentWorkOrders.get(id);
  };

  public shared ({ caller }) func deleteWorkOrder(id : Text) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can delete work orders");
    };
    if (not persistentWorkOrders.containsKey(id)) { return };
    persistentWorkOrders.remove(id);
  };

  public shared ({ caller }) func updateWorkOrder(workOrder : WorkOrder) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can update work orders");
    };
    if (not persistentWorkOrders.containsKey(workOrder.id)) {
      return;
    };

    persistentWorkOrders.add(workOrder.id, workOrder);
  };

  public shared ({ caller }) func createWorkOrder(customerName : Text, customerPhone : Text, vehicles : [Text], dateIn : Int, problemDescription : Text, repairAction : Text, technician : Text) : async WorkOrder {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can create work orders");
    };
    persistentNextWorkOrderId += 1;
    persistentNextWorkOrderNumber += 1;

    let orderNumber = makeOrderNumber(Time.now());
    let id = persistentNextWorkOrderId.toText();

    let workOrder : WorkOrder = {
      id;
      workOrderNumber = orderNumber;
      customerName;
      customerPhone;
      vehicles;
      dateIn;
      dateOut = null;
      problemDescription;
      repairAction;
      technician;
      status = #pending;
    };

    persistentWorkOrders.add(id, workOrder);
    workOrder;
  };

  func makeOrderNumber(time : Int) : Text {
    let year = Int.abs((time / 1_000_000_000) / (60 * 60 * 24 * 365));
    let month = Int.abs((time / 1_000_000_000) / (60 * 60 * 24 * 30));
    let day = Int.abs((time / 1_000_000_000) / (60 * 60 * 24));

    let yearSuffix = year % 100;
    timeOrderNumberString(yearSuffix, month, day, persistentNextWorkOrderNumber);
  };

  func timeOrderNumberString(year : Nat, month : Nat, day : Nat, number : Nat) : Text {
    let yearStr = padLeft(year.toText(), "0", 2);
    let monthStr = padLeft(month.toText(), "0", 2);
    let dayStr = padLeft(day.toText(), "0", 2);
    let numberStr = padLeft(number.toText(), "0", 4);

    yearStr # monthStr # dayStr # numberStr;
  };

  func padLeft(str : Text, padChar : Text, desiredLength : Nat) : Text {
    let currentLength = str.size();
    if (currentLength >= desiredLength) { return str };

    let paddingLength = desiredLength - currentLength;
    var paddedResult = str;
    for (_ in Nat.range(0, paddingLength)) {
      paddedResult := padChar # paddedResult;
    };
    paddedResult;
  };
};
