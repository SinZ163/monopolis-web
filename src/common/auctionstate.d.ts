import { PlayerID } from "./utils"

interface AuctionPlayerState {
    hasWithdrawn: boolean
}
interface AuctionState {
    current_bid: number,
    current_bidder: PlayerID,
    current_owner: PlayerID,
    
    playerStates: Partial<Record<PlayerID, AuctionPlayerState>>,    
    historical_bids: Array<{
        pID: PlayerID,
        amount: number
    }>
}