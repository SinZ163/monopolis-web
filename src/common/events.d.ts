import { PurchasableTiles, PlayerID } from "./utils";

interface CustomGameEventDeclarations {
    // Available in state start, auxroll_prompt
    monopolis_requestdiceroll: MonopolisEmptyEvent, //C-->S
    // Available in state payrent
    monopolis_requestpayrent: MonopolisEmptyEvent, //C-->S
    // Available in state unowned
    monopolis_requestauction: MonopolisEmptyEvent, //C-->S
    monopolis_requestpurchase: MonopolisEmptyEvent, //C-->S
    // Available in state card_prompt
    monopolis_requestcard: MonopolisEmptyEvent, //C-->S
    // Available in state card_result
    monopolis_acknowledgecard: MonopolisEmptyEvent, //C-->S
    // Available in state endturn
    monopolis_endturn: MonopolisEmptyEvent, //C-->S
    // Available in state endturn, payrent* and card_result*
    monopolis_requestrenovation: MonopolisRenovationEvent,  //C-->S
    monopolis_requesttrade: MonopolisEmptyEvent, //C-->S

    // Available in state payrent* and card_result*
    monopolis_requestbankrupt: boolean|undefined, //C-->S

    monopolis_requestpass: MonopolisEmptyEvent, //C-->S

    // Available in state auction
    monopolis_auctionbid: MonopolisAuctionBid, //C-->S
    monopolis_auctionwithdraw: MonopolisEmptyEvent, //C-->S

    monopolis_trade: MonopolisTradeEvent, //C-->S

    lobby_addteam: LobbyAddTeamEvent,
    lobby_addplayer: LobbyAddPlayerEvent,
    lobby_jointeam: LobbyJoinTeamEvent,
    lobby_start: MonopolisEmptyEvent,
}
interface StartEvents {
    start_lobbycreate: StartLobbyCreateEvent,
    start_lobbyjoin: StartLobbyJoinEvent,
    start_lobbyleave: MonopolisEmptyEvent,
    start_createuser: StartCreateUserEvent,
}
interface StartCreateUserEvent {
    playerName: string,
    localId: string,
}
interface StartLobbyCreateEvent {
    lobbyName: string,
}
interface StartLobbyJoinEvent {
    lobbyId: string,
}

interface LobbyAddTeamEvent {
    teamName: string,
}
interface LobbyAddPlayerEvent {
    playerColour: number,
}
interface LobbyJoinTeamEvent {
    teamId: number,
}

type MonopolisEmptyEvent = undefined;
interface MonopolisRenovationEvent {
    property: PurchasableTiles;
    houseCount: number;
}

interface MonopolisAuctionBid {
    amount: 10|50|100,
}

interface MonopolisAddPropertyTradeEvent {
    type: "add_property",
    property: PurchasableTiles,
    from: PlayerID,
    to: PlayerID,
}
interface MonopolisAddMoneyTradeEvent {
    type: "add_money",
    money: number,
    from: PlayerID,
    to: PlayerID,
}
interface MonopolisRemovePropertyTradeEvent {
    type: "remove_property",
    property: PurchasableTiles
}
interface MonopolisRemoveMoneyTradeEvent {
    type: "remove_money",
    money: number,
    from: PlayerID,
    to: PlayerID,
}
interface MonopolisConfirmTradeEvent {
    type: "confirm"
}
interface MonopolisCancelTradeEvent {
    type: "cancel"
}
interface MonopolisAcceptTradeEvent {
    type: "accept"
}
interface MonopolisRejectTradeEvent {
    type: "reject"
}

type MonopolisTradeEvent = MonopolisAddPropertyTradeEvent | MonopolisRemovePropertyTradeEvent | MonopolisAddMoneyTradeEvent | MonopolisRemoveMoneyTradeEvent | MonopolisConfirmTradeEvent | MonopolisCancelTradeEvent | MonopolisAcceptTradeEvent | MonopolisRejectTradeEvent;
