/**
 * BaseStorage provides common functionality for all storage classes.
 * It includes a helper injection system for cross-domain dependencies.
 */

type HelperFunction = (...args: any[]) => any;
type HelperMap = Map<string, HelperFunction>;

export class BaseStorage {
  private helpers: HelperMap = new Map();

  /**
   * Register a helper function for cross-domain operations.
   * This allows domains to access functionality from other domains
   * without direct imports, maintaining loose coupling.
   * 
   * @param name The name of the helper function
   * @param fn The helper function to register
   */
  registerHelper(name: string, fn: HelperFunction): void {
    this.helpers.set(name, fn);
  }

  /**
   * Get a registered helper function by name.
   * Returns undefined if the helper is not registered.
   * 
   * @param name The name of the helper function
   * @returns The helper function or undefined
   */
  protected getHelper(name: string): HelperFunction | undefined {
    return this.helpers.get(name);
  }

  /**
   * Check if a helper is registered.
   * 
   * @param name The name of the helper function
   * @returns true if the helper is registered, false otherwise
   */
  protected hasHelper(name: string): boolean {
    return this.helpers.has(name);
  }

  /**
   * Register multiple helpers at once.
   * Useful for bulk registration during initialization.
   * 
   * @param helpers Object with helper names as keys and functions as values
   */
  registerHelpers(helpers: Record<string, HelperFunction>): void {
    Object.entries(helpers).forEach(([name, fn]) => {
      this.registerHelper(name, fn);
    });
  }
}