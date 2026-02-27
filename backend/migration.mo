import Map "mo:core/Map";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Set "mo:core/Set";
import Time "mo:core/Time";
import Storage "blob-storage/Storage";

module {
  type ItemKind = {
    #service;
    #goods;
  };

  type InventoryItem = {
    id : Text;
    name : Text;
    sellingPrice : Nat;
    purchasePrice : Nat;
    quantity : ?Nat;
    kind : ItemKind;
  };

  type TransactionItem = {
    id : Text;
    name : Text;
    price : Nat;
    quantity : Nat;
    itemType : ItemKind;
  };

  type Transaction = {
    id : Nat;
    timestamp : Time.Time;
    items : [TransactionItem];
    total : Nat;
    customerName : Text;
    vehicleInfo : Text;
  };

  type ShopSettings = {
    logo : ?Storage.ExternalBlob;
    shopName : Text;
    address : Text;
    phoneNumber : Text;
    thankYouMessage : Text;
  };

  type DailyReport = {
    day : Time.Time;
    totalRevenue : Nat;
    transactionCount : Nat;
  };

  type MonthlyReport = {
    month : Time.Time;
    totalRevenue : Nat;
    transactionCount : Nat;
  };

  type State = {
    persistentNextTransactionId : Nat;
    persistentSettings : ?ShopSettings;
    persistentCustomers : Set.Set<Text>;
    persistentTransactions : Map.Map<Nat, Transaction>;
    persistentInventory : Map.Map<Text, InventoryItem>;
  };

  public func run(state : State) : State {
    state;
  };
};
