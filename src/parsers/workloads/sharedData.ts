// src/Singleton.ts

class SharedData {
    private static instance: SharedData;

    // Shared data properties
    public sharedValue1: number = 0;
    public sharedValue2: string = '';
    public sharedArray: string[] = [];

    // Private constructor to prevent instantiation
    private constructor() {}

    // Static method to get the singleton instance
    public static getInstance(): SharedData {
        if (!SharedData.instance) {
            SharedData.instance = new SharedData();
        }
        return SharedData.instance;
    }

    // Methods to manipulate shared data
    public updateSharedValue1(value: number): void {
        this.sharedValue1 = value;
    }

    public addToSharedArray(item: string): void {
        this.sharedArray.push(item);
    }
}

export const sharedData = SharedData.getInstance();
