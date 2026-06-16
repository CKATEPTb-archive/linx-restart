export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.name && error.name !== 'Error' ? `${error.name}: ${error.message}` : error.message;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  if (error && typeof error === 'object') {
    const record = error as { name?: unknown; message?: unknown; code?: unknown };
    const parts: string[] = [];
    if (record.name) parts.push(String(record.name));
    if (record.message) parts.push(String(record.message));
    if (record.code) parts.push(`code=${String(record.code)}`);
    if (parts.length > 0) return parts.join(': ');
    try {
      const json = JSON.stringify(error);
      if (json && json !== '{}') return json;
    } catch {
      // Fall through to generic Web Bluetooth message.
    }
  }
  return 'Неизвестная ошибка WebBLE без сообщения';
}
