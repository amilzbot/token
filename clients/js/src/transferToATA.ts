import { InstructionPlan, sequentialInstructionPlan, Address, TransactionSigner } from '@solana/kit';
import {
    findAssociatedTokenPda,
    getCreateAssociatedTokenIdempotentInstruction,
    getTransferCheckedInstruction,
    TOKEN_PROGRAM_ADDRESS,
} from './generated';

export type TransferToATAInstructionPlanInput = {
    /** Funding account (must be a system account). */
    payer: TransactionSigner;
    /** The token mint to transfer. */
    mint: Address;
    /** The source account for the transfer. */
    source: Address;
    /** The source account's owner/delegate or its multisignature account. */
    authority: Address | TransactionSigner;
    /** Associated token account address to transfer to.
     * Will be created if it does not already exist.
     * Note: Use {@link getTransferToATAInstructionPlanAsync} instead to derive this automatically.
     * Note: Use {@link findAssociatedTokenPda} to derive the associated token account address.
     */
    destination: Address;
    /** Wallet address for the destination. */
    recipient: Address;
    /** The amount of tokens to transfer. */
    amount: number | bigint;
    /** Expected number of base 10 digits to the right of the decimal place. */
    decimals: number;
    multiSigners?: Array<TransactionSigner>;
};

type TransferToATAInstructionPlanConfig = {
    systemProgram?: Address;
    tokenProgram?: Address;
    associatedTokenProgram?: Address;
};

export function getTransferToATAInstructionPlan(
    input: TransferToATAInstructionPlanInput,
    config?: TransferToATAInstructionPlanConfig,
): InstructionPlan {
    return sequentialInstructionPlan([
        getCreateAssociatedTokenIdempotentInstruction(
            {
                payer: input.payer,
                ata: input.destination,
                owner: input.recipient,
                mint: input.mint,
                systemProgram: config?.systemProgram,
                tokenProgram: config?.tokenProgram,
            },
            {
                programAddress: config?.associatedTokenProgram,
            },
        ),
        getTransferCheckedInstruction(
            {
                source: input.source,
                mint: input.mint,
                destination: input.destination,
                authority: input.authority,
                amount: input.amount,
                decimals: input.decimals,
                multiSigners: input.multiSigners,
            },
            {
                programAddress: config?.tokenProgram,
            },
        ),
    ]);
}

/**
 * Async input that makes `source` and `destination` derivable.
 *
 * - `source` is optional: when omitted, derived from `authority` address + `mint` via ATA PDA.
 * - `destination` is always derived from `recipient` + `mint`.
 * - `authority` is required here (the plugin defaults it to `client.payer`).
 */
export type TransferToATAInstructionPlanAsyncInput = Omit<
    TransferToATAInstructionPlanInput,
    'destination' | 'source'
> & {
    /** Source token account. When omitted, derived from authority's address + mint. */
    source?: Address;
    /** Token program address. Defaults to TOKEN_PROGRAM_ADDRESS. */
    tokenProgram?: Address;
};

export async function getTransferToATAInstructionPlanAsync(
    input: TransferToATAInstructionPlanAsyncInput,
    config?: TransferToATAInstructionPlanConfig,
): Promise<InstructionPlan> {
    const tokenProgram = config?.tokenProgram ?? input.tokenProgram ?? TOKEN_PROGRAM_ADDRESS;

    // Derive destination ATA from recipient + mint.
    const [destinationAta] = await findAssociatedTokenPda({
        owner: input.recipient,
        tokenProgram,
        mint: input.mint,
    });

    // Derive source ATA if not provided.
    let source = input.source;
    if (!source) {
        const authorityAddress: Address =
            typeof input.authority === 'object' && 'address' in input.authority
                ? input.authority.address
                : (input.authority as Address);
        const [sourceAta] = await findAssociatedTokenPda({
            owner: authorityAddress,
            tokenProgram,
            mint: input.mint,
        });
        source = sourceAta;
    }

    return getTransferToATAInstructionPlan(
        {
            ...input,
            source,
            destination: destinationAta,
        },
        { ...config, tokenProgram },
    );
}
