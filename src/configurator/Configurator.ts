import { FieldManager } from "./FieldManager";

export type OnValueChangeCallback = (valueId: number) => void;

export class Configurator<TMeta, TValue> {
  private _configuration: number[];
  private _callbacks: OnValueChangeCallback[][];

  public constructor(public readonly manager: FieldManager<TMeta, TValue>) {
    this._configuration = manager.fields.map(field => field.defaultValue);
    this._callbacks = manager.fields.map(_ => []);
  }

  public get configuration(): ReadonlyArray<number> {
    return this._configuration;
  }

  public getDomain(fieldId: number): number[] {
    return this.manager.getValues(fieldId)?.map((_, i) => i) || [];
  }

  public getValue(fieldId: number): number | undefined {
    return this.configuration[fieldId];
  }

  public setValue(fieldId: number, valueId: number) {
    if (this._configuration[fieldId] === undefined) {
      throw new Error(`Invalid field ${fieldId}`);
    }

    const value = this.manager.getValue(fieldId, valueId);
    if (value === undefined) {
      throw new Error(`Invalid value ${valueId} for field ${fieldId}`);
    }

    this._configuration[fieldId] = valueId;

    this._onValueChange(fieldId, valueId);
  }

  public onValueChange(field: number, callback: OnValueChangeCallback) {
    const callbacks = this._callbacks[field];
    if (callbacks === undefined) {
      throw new Error(`Invalid variant set ${field}`);
    }

    callbacks.push(callback);
  }

  public offVariantChange(variantSet: number, callback: OnValueChangeCallback) {
    const callbacks = this._callbacks[variantSet];
    if (callbacks === undefined) {
      throw new Error(`Invalid variant set ${variantSet}`);
    }

    const index = callbacks.indexOf(callback);
    if (index === -1) {
      return;
    }

    callbacks.splice(index, 1);
  }

  private _onValueChange(fieldId: number, valueId: number) {
    const callbacks = this._callbacks[fieldId];
    callbacks.forEach(callback => callback(valueId));
  }
}
