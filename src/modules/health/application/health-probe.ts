/** Port: asks whether the database answers. `infrastructure/` implements it (D-22). */
export interface IHealthProbe {
  isDatabaseAvailable(): Promise<boolean>;
}
