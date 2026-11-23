/**
 * The single shape of every use case (D-38, ARQ-03-API §1): one class, one method, one input object.
 * Because they all look the same, one aspect (logging, metrics, cache) can wrap any of them (D-42).
 */
export interface UseCase<I, O> {
  execute(input: I): Promise<O>;
}
