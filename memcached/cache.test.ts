import Memcached from "memcached";
import { expect } from "chai";

const delay = (time: number) => {
    return new Promise(function (resolve) {
        setTimeout(resolve, time)
    });
}

const config = {
    memcachedURI: 'localhost:11211',
};

const MEMCACHE_OPTIONS = {
    retries: 2,
    retry: 5000,
};

class CacheService {
    private static memcached: Memcached;

    static async set(key: string, data: any, lifetime: number): Promise<void> {
        data._last_updated = new Date().toISOString();
        data._in_cache = true;
        return new Promise((resolve, reject) => {
            CacheService.getMemcached().set(key, data, lifetime, (err: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    static async get(key: string): Promise<any> {
        return new Promise((resolve, reject) => {
            CacheService.getMemcached().get(key, (err: any, data: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }

    static async clear(key: string): Promise<void> {
        return new Promise((resolve, reject) => {
            CacheService.getMemcached().del(key, (err: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    static flush(): Promise<void> {
        return new Promise((resolve, reject) => {
            CacheService.getMemcached().flush((err: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    static checkConnection(): Promise<void> {
        return new Promise((resolve, reject) => {
            CacheService.getMemcached().stats((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    static getMemcached(): Memcached {
        if (!CacheService.memcached) {
            CacheService.memcached = new Memcached(config.memcachedURI, MEMCACHE_OPTIONS);
        }
        return CacheService.memcached;
    }

    static closeConnection(): void {
        CacheService.getMemcached().end();  // Close the Memcached connection when done
    }
}

// Mock Memcached
const MOCK_DATETIME = new Date().toISOString();
let mockMemcachedObj: any = {}

jest.mock('memcached', () => {
    return jest.fn().mockImplementation(() => {
        return {
            set: jest.fn().mockImplementation(
                async (key: string, data: any, lifetime: number, callback: any) => {
                    data._in_cache = true;
                    data._last_updated = MOCK_DATETIME;
                    mockMemcachedObj[key] = data;
                    callback(null);
                }),
            get: jest.fn().mockImplementation(
                async (key: string, callback: any) => {
                    callback(null, mockMemcachedObj[key]);
                }),
            del: jest.fn().mockImplementation(
                async (key: string, callback: any) => {
                    callback(null);
                }),
            flush: jest.fn().mockImplementation(
                async (callback: any) => {
                    callback(null);
                }),
        };
    });
});

const mockDelay = jest.fn().mockImplementation(async (ms: number) => {
    await delay(ms);
    mockMemcachedObj = {};
    return new Promise(resolve => setTimeout(resolve, ms));
});


describe('Tests CacheService', () => {

    test('Should set and get data from cache', async () => {
        // Arrange
        const key = 'test-key';
        const data = { test: 'test' };
        const lifetime = 3; // seconds

        // Act
        await CacheService.set(key, data, lifetime);
        const result = await CacheService.get(key);

        // Assert
        // check data
        expect(result, 'Expect the result to be the same as the data we set').to.deep.equal(data);
        expect(result._in_cache, 'Expect the result to have _in_cache = true').to.be.true;
        expect(result._last_updated, 'Expect the result to have _last_updated').to.be.not.undefined;

        // check lifetime
        await mockDelay(lifetime * 1000 + 1000);
        const resultAfterDelay = await CacheService.get(key);
        expect(resultAfterDelay, 'Expect cached data to be cleared after over 1 second (lifetime + 1 second)').to.be.undefined;
    });
});