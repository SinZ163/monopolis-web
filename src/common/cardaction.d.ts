import { Tiles } from "./utils";

interface BaseCardAction {
    text: string
}

interface TeleportCardAction extends BaseCardAction {
    type: "teleport",
    dest: Tiles,
}
interface TeleportCategoryCardAction extends BaseCardAction {
    type: "teleport_category",
    dest: "Railroad" | "Utility",
}
interface TeleportRelativeCardAction extends BaseCardAction {
    type: "teleport_relative",
    value: number
}

interface MoneyGainCardAction extends BaseCardAction {
    type: "money_gain",
    value: number,
}
interface MoneyGainOthersCardAction extends BaseCardAction {
    type: "money_gain_others",
    value: number,
}
interface MoneyLoseCardAction extends BaseCardAction {
    type: "money_lose",
    value: number,
}
interface MoneyLoseOthersCardAction extends BaseCardAction {
    type: "money_lose_others",
    value: number,
}

interface GOTOJailCardAction extends BaseCardAction {
    type: "jail"
}
interface FUCKJailCardAction extends BaseCardAction {
    type: "fuckjail"
}

interface RepairsCardAction extends BaseCardAction {
    type: "repairs",
    house: number,
    hotel: number,
}

type CardAction = TeleportCardAction | TeleportCategoryCardAction | TeleportRelativeCardAction | MoneyGainCardAction | MoneyLoseCardAction | MoneyGainOthersCardAction | MoneyLoseOthersCardAction | GOTOJailCardAction | FUCKJailCardAction | RepairsCardAction;
