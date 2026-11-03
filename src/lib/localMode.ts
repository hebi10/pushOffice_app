export function hasFirebaseConfig(config: {
    apiKey: string;
    projectId: string;
    appId: string;
}): boolean {
    return Boolean(config.apiKey.trim() && config.projectId.trim() && config.appId.trim());
}
export function chooseStartupMode(saved: string | null, configured: boolean): 'local' | 'firebase' {
    return saved === 'firebase' && configured ? 'firebase' : 'local';
}
/** Lazy boundary: local startup can import cloud code without constructing any cloud service. */
export function configuredResource<T>(config: {
    apiKey: string;
    projectId: string;
    appId: string;
}, initialize: () => T): () => T {
    let value: T | undefined;
    return () => {
        if (!hasFirebaseConfig(config))
            throw new Error('Firebase가 설정되지 않았습니다. 로컬 일정을 사용해 주세요.');
        return value ??= initialize();
    };
}
