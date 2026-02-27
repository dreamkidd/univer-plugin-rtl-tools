declare module 'bidi-js' {
    interface EmbeddingLevelsResult {
        levels: Uint8Array;
        paragraphs: Array<{ start: number; end: number; level: number }>;
    }

    interface BidiEngine {
        getEmbeddingLevels(
            text: string,
            baseDirection?: 'ltr' | 'rtl' | 'auto'
        ): EmbeddingLevelsResult;

        getReorderSegments(
            text: string,
            embeddingLevelsResult: EmbeddingLevelsResult,
            start?: number,
            end?: number
        ): Array<[number, number]>;

        getReorderedString(
            text: string,
            embeddingLevelsResult: EmbeddingLevelsResult,
            start?: number,
            end?: number
        ): string;
    }

    export default function bidiFactory(): BidiEngine;
}
