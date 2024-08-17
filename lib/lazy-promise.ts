export class LazyPromise<T> extends Promise<T> {
  readonly #executor: (
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason: Error) => void,
  ) => void;

  #inner: Promise<T> | undefined;

  constructor(
    executor: (
      resolve: (value: T | PromiseLike<T>) => void,
      reject: (reason: Error) => void,
    ) => void,
  ) {
    // noop executor, we use our own
    super(() => {});
    this.#executor = executor;
  }

  public static from<TStatic>(asyncFn: () => TStatic | PromiseLike<TStatic>) {
    return new LazyPromise<TStatic>((resolve) => {
      resolve(asyncFn());
    });
  }

  public static override resolve(): Promise<void>;
  public static override resolve<T>(value: T): Promise<Awaited<T>>;
  public static override resolve<T>(
    value: T | PromiseLike<T>,
  ): Promise<Awaited<T>>;
  public static override resolve<T>(value?: T | PromiseLike<T>) {
    if (typeof value !== 'undefined') {
      return new LazyPromise<T>((resolve) => {
        resolve(value);
      });
    }
    return new LazyPromise<void>((resolve) => {
      resolve();
    });
  }

  public static override reject<TStatic>(reason: Error) {
    return new LazyPromise<TStatic>((_, reject) => {
      reject(reason);
    });
  }

  public override then<TResult1 = T, TResult2 = never>(
    onfulfilled: (value: T) => TResult1 | PromiseLike<TResult1>,
    onrejected?: (reason: Error) => TResult2 | PromiseLike<TResult2>,
  ) {
    this.#inner ??= new Promise(this.#executor);
    return this.#inner.then(onfulfilled, onrejected);
  }

  public override catch<TResult2 = never>(
    onrejected: (reason: Error) => TResult2 | PromiseLike<TResult2>,
  ) {
    this.#inner ??= new Promise(this.#executor);
    return this.#inner.catch(onrejected);
  }
}
