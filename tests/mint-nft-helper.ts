import * as anchor from '@project-serum/anchor';
import {
    Connection,
    Keypair,
    clusterApiUrl,
    LAMPORTS_PER_SOL,
    PublicKey,
} from "@solana/web3.js";

import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";

export const mintNft = async (provider: anchor.Provider, nftPrice: number, vaultAddress: any): Promise<{ ownerKeypair: Keypair, mintAddress: PublicKey, nftPrice: number }> => {
    const connection = provider.connection// new Connection(clusterApiUrl("devnet"), "confirmed");

    const userKeypair = Keypair.generate();

    // Airdrop SOL for the user to create the NFT
    const airdropSignature = await connection.requestAirdrop(
        userKeypair.publicKey,
        5 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(airdropSignature, "confirmed");

    // Create the Mint Account for the NFT
    const mintAccount = await Token.createMint(
        connection,
        userKeypair,
        userKeypair.publicKey,
        null,
        0,
        TOKEN_PROGRAM_ID
    );

    console.log("mint account: ", mintAccount.publicKey.toString());
    console.log("mint account program id: ", mintAccount.programId.toString());

    // Get/Create the Associated Account for the user to hold the NFT
    const userAssosciatedAccount =
        await mintAccount.getOrCreateAssociatedAccountInfo(
            userKeypair.publicKey
        );

    // console.log("user associated account: ", userAssosciatedAccount);

    // Mint 1 token to the user's associated account
    await mintAccount.mintTo(
        userAssosciatedAccount.address,
        userKeypair.publicKey,
        [],
        1
    );

    // Reset mint_authority to null from the user to prevent further minting
    await mintAccount.setAuthority(
        mintAccount.publicKey,
        null,
        "MintTokens",
        userKeypair.publicKey,
        []
    );

    // Checking balance of the user's associated account
    const accountInfo = await mintAccount.getAccountInfo(
        userAssosciatedAccount.address
    );
    console.log("Balance: ", accountInfo.amount.toString());

    /**
     * Transfer NFT Price to vault to mimic real world balance
     */
    let transferIx = anchor.web3.SystemProgram.transfer({ fromPubkey: userKeypair.publicKey, toPubkey: vaultAddress, lamports: nftPrice });
    let transferTx = new anchor.web3.Transaction()
        .add(transferIx);
    await provider.connection.confirmTransaction(
        await provider.connection.sendTransaction(transferTx, [userKeypair])
    );

    return {
        ownerKeypair: userKeypair,
        mintAddress: mintAccount.publicKey,
        nftPrice
    }
};