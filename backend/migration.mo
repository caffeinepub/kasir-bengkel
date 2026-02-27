import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Set "mo:core/Set";
import Time "mo:core/Time";
import Storage "blob-storage/Storage";

module {
  // Old types
  type OldInventoryType = {
    #service;
    #product;
  };

  type OldTransactionItem = {
    id : Nat;
    name : Text;
    price : Nat;
    quantity : Nat;
    itemType : OldInventoryType;
  };

  type OldTransaction = {
    id : Nat;
    timestamp : Time.Time;
    items : [OldTransactionItem];
    total : Nat;
    customerName : Text;
    vehicleInfo : Text;
  };

  type OldProduct = {
    id : Nat;
    name : Text;
    price : Nat;
    stock : Nat;
  };

  type OldService = {
    id : Nat;
    name : Text;
    price : Nat;
    description : Text;
  };

  type OldShopSettings = {
    logo : ?Storage.ExternalBlob;
    shopName : Text;
    address : Text;
    phoneNumber : Text;
    thankYouMessage : Text;
  };

  type OldDailyReport = {
    day : Time.Time;
    totalRevenue : Nat;
    transactionCount : Nat;
  };

  type OldMonthlyReport = {
    month : Time.Time;
    totalRevenue : Nat;
    transactionCount : Nat;
  };

  // Old actor state
  type OldActor = {
    persistentSettings : ?OldShopSettings;
    persistentTransactions : Map.Map<Nat, OldTransaction>;
    persistentCustomers : Set.Set<Text>;
    persistentProducts : Map.Map<Nat, OldProduct>;
    persistentServices : Map.Map<Nat, OldService>;
  };

  // New types
  type ProductType = {
    #goods;
    #service;
  };

  type InventoryItem = {
    id : Nat;
    name : Text;
    sellingPrice : Nat;
    purchasePrice : Nat;
    quantity : ?Nat; // null if not applicable (services)
    productType : ProductType;
  };

  type TransactionItem = {
    id : Nat;
    name : Text;
    price : Nat;
    quantity : Nat;
    itemType : ProductType;
  };

  type Transaction = {
    id : Nat;
    timestamp : Time.Time;
    items : [TransactionItem];
    total : Nat;
    customerName : Text;
    vehicleInfo : Text;
  };

  // New actor state
  type NewActor = {
    persistentSettings : ?OldShopSettings;
    persistentTransactions : Map.Map<Nat, Transaction>;
    persistentCustomers : Set.Set<Text>;
    persistentInventory : Map.Map<Nat, InventoryItem>;
  };

  // Migration function from old to new actor state
  public func run(old : OldActor) : NewActor {
    let persistentInventory = Map.empty<Nat, InventoryItem>();

    // Convert products to inventory items of type goods
    for ((id, product) in old.persistentProducts.entries()) {
      let inventoryItem : InventoryItem = {
        id = product.id;
        name = product.name;
        sellingPrice = product.price;
        purchasePrice = product.price; // Assuming missing purchase price is same as selling price
        quantity = ?product.stock;
        productType = #goods;
      };
      persistentInventory.add(id, inventoryItem);
    };

    // Convert services to inventory items of type service
    for ((id, service) in old.persistentServices.entries()) {
      let inventoryItem : InventoryItem = {
        id = service.id;
        name = service.name;
        sellingPrice = service.price;
        purchasePrice = service.price; // Assuming missing purchase price is same as selling price
        quantity = null;
        productType = #service;
      };
      persistentInventory.add(id, inventoryItem);
    };

    // Convert transaction items to new type
    let persistentTransactions = old.persistentTransactions.map<Nat, OldTransaction, Transaction>(
      func(_id, oldTransaction) {
        let newItems = oldTransaction.items.map(func(oldItem) { convertTransactionItem(oldItem) });
        {
          oldTransaction with items = newItems;
        };
      }
    );

    {
      persistentSettings = old.persistentSettings;
      persistentTransactions;
      persistentCustomers = old.persistentCustomers;
      persistentInventory;
    };
  };

  // Helper function to convert old transaction items to new type
  func convertTransactionItem(oldItem : OldTransactionItem) : TransactionItem {
    let itemType = switch (oldItem.itemType) {
      case (#service) { #goods };
      case (#product) { #service };
    };
    { oldItem with itemType };
  };
};
