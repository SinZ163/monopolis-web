import { PurchasableTiles, PlayerID } from "./utils";

interface PropertyTradeOffer {
    type: "property";
    property: PurchasableTiles;
    from: PlayerID;
    to: PlayerID;
}
interface MoneyTradeOffer {
    type: "money";
    money: number;
    from: PlayerID;
    to: PlayerID;
}
type TradeOffers = PropertyTradeOffer | MoneyTradeOffer;
interface TradeState {
    initiator: PlayerID,
    current: PlayerID,
    participants: PlayerID[],
    offers: TradeOffers[],
    deltaMoney: Partial<Record<PlayerID, number>>,
    confirmations: Partial<Record<PlayerID, boolean>>,
    status: TradeStateStatus
}
declare const enum TradeStateStatus {
    ModifyTrade,
    Confirmation,
}