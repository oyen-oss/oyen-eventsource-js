export function deferred<T extends void>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => {};
  let reject: (err: Error) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

export function errToStr(err: unknown): string {
  if (err instanceof Error) {
    if ('cause' in err && err.cause) {
      return `${err.message} caused by ${errToStr(err.cause)}`;
    }
    if ('code' in err && err.code) {
      return `${err.message} (code ${err.code})`;
    }
    return err.message;
  }
  return String(err);
}
