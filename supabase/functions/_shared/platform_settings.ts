export async function getPlatformSetting(
  supabase: any,
  key: string,
  fallback = ''
): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error) {
      console.warn(`[PlatformSettings] Failed to load ${key}:`, error);
      return fallback;
    }

    return typeof data?.value === 'string' ? data.value : fallback;
  } catch (error) {
    console.warn(`[PlatformSettings] Unexpected error loading ${key}:`, error);
    return fallback;
  }
}

export async function getPlatformSettingJson<T>(
  supabase: any,
  key: string,
  fallback: T
): Promise<T> {
  const raw = await getPlatformSetting(supabase, key, '');
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`[PlatformSettings] Invalid JSON for ${key}:`, error);
    return fallback;
  }
}
