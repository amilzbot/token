import { ClientWithPayer, pipe } from '@solana/kit';
import { addSelfPlanAndSendFunctions, SelfPlanAndSendFunctions } from '@solana/kit/program-client-core';

import { CreateMintInstructionPlanInput, getCreateMintInstructionPlan } from './createMint';
import {
    TokenPlugin as GeneratedTokenPlugin,
    TokenPluginInstructions as GeneratedTokenPluginInstructions,
    TokenPluginRequirements as GeneratedTokenPluginRequirements,
    tokenProgram as generatedTokenProgram,
} from './generated';
import { getMintToATAInstructionPlan, MintToATAInstructionPlanInput } from './mintToATA';
import {
    getTransferToATAInstructionPlanAsync,
    TransferToATAInstructionPlanAsyncInput,
} from './transferToATA';

export type TokenPluginRequirements = GeneratedTokenPluginRequirements & ClientWithPayer;

export type TokenPlugin = Omit<GeneratedTokenPlugin, 'instructions'> & { instructions: TokenPluginInstructions };

export type TokenPluginInstructions = GeneratedTokenPluginInstructions & {
    createMint: (
        input: MakeOptional<CreateMintInstructionPlanInput, 'payer'>,
    ) => ReturnType<typeof getCreateMintInstructionPlan> & SelfPlanAndSendFunctions;
    mintToATA: (
        input: MakeOptional<MintToATAInstructionPlanInput, 'payer'>,
    ) => ReturnType<typeof getMintToATAInstructionPlan> & SelfPlanAndSendFunctions;
    /**
     * Transfer tokens to a recipient's ATA (created if needed).
     *
     * Defaults:
     * - `payer` defaults to `client.payer`
     * - `authority` defaults to `client.payer`
     * - `source` auto-derived from authority + mint when omitted
     * - `destination` auto-derived from recipient + mint
     */
    transferToATA: (
        input: MakeOptional<TransferToATAInstructionPlanAsyncInput, 'payer' | 'authority'>,
    ) => Promise<Awaited<ReturnType<typeof getTransferToATAInstructionPlanAsync>>> & SelfPlanAndSendFunctions;
};

export function tokenProgram() {
    return <T extends TokenPluginRequirements>(client: T) => {
        return pipe(client, generatedTokenProgram(), c => ({
            ...c,
            token: <TokenPlugin>{
                ...c.token,
                instructions: {
                    ...c.token.instructions,
                    createMint: input =>
                        addSelfPlanAndSendFunctions(
                            client,
                            getCreateMintInstructionPlan({ ...input, payer: input.payer ?? client.payer }),
                        ),
                    mintToATA: input =>
                        addSelfPlanAndSendFunctions(
                            client,
                            getMintToATAInstructionPlan({ ...input, payer: input.payer ?? client.payer }),
                        ),
                    transferToATA: input =>
                        addSelfPlanAndSendFunctions(
                            client,
                            getTransferToATAInstructionPlanAsync({
                                ...input,
                                payer: input.payer ?? client.payer,
                                authority: input.authority ?? client.payer,
                            }),
                        ),
                },
            },
        }));
    };
}

type MakeOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
