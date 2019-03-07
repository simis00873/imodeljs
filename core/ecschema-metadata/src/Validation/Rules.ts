/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { AnyClass, AnyECType } from "../Interfaces";
import { StructClass } from "../Metadata/Class";
import { Constant } from "../Metadata/Constant";
import { CustomAttribute, CustomAttributeContainerProps } from "../Metadata/CustomAttribute";
import { CustomAttributeClass } from "../Metadata/CustomAttributeClass";
import { EntityClass } from "../Metadata/EntityClass";
import { Enumeration } from "../Metadata/Enumeration";
import { Format } from "../Metadata/Format";
import { InvertedUnit } from "../Metadata/InvertedUnit";
import { KindOfQuantity } from "../Metadata/KindOfQuantity";
import { Mixin } from "../Metadata/Mixin";
import { Phenomenon } from "../Metadata/Phenomenon";
import { AnyProperty } from "../Metadata/Property";
import { PropertyCategory } from "../Metadata/PropertyCategory";
import { RelationshipClass, RelationshipConstraint } from "../Metadata/RelationshipClass";
import { Schema } from "../Metadata/Schema";
import { SchemaItem } from "../Metadata/SchemaItem";
import { Unit } from "../Metadata/Unit";
import { UnitSystem } from "../Metadata/UnitSystem";
import { BaseDiagnostic } from "./Diagnostic";

/** Interface used for all rule implementations used during schema validation. */
export type IRule<T extends AnyECType, U = {}> = (ecDefinition: T, ...args: U[]) => AsyncIterable<BaseDiagnostic<T, any[]>>;
export type BaseRule<T extends AnyECType, U extends AnyECType> = IRule<T, U>;

/** Interface used to represent logical collection of [[IRule]] instances. */
export interface IRuleSet {
  /** The name of the rule set. */
  name: string;

  /** The rules that apply to [[Schema]] objects. */
  schemaRules?: Array<IRule<Schema>>;
  /** The rules that apply to [[SchemaItem]] objects. */
  schemaItemRules?: Array<IRule<SchemaItem>>;
  /** The rules that apply to [[ECClass]] objects. */
  classRules?: Array<IRule<AnyClass>>;
  /** The rules that apply to [[Property]] objects. */
  propertyRules?: Array<IRule<AnyProperty>>;
  /** The rules that apply to [[EntityClass]] objects. */
  entityClassRules?: Array<IRule<EntityClass>>;
  /** The rules that apply to [[StructClass]] objects. */
  structClassRules?: Array<IRule<StructClass>>;
  /** The rules that apply to [[Mixin]] objects. */
  mixinRules?: Array<IRule<Mixin>>;
  /** The rules that apply to [[RelationshipClass]] objects. */
  relationshipRules?: Array<IRule<RelationshipClass>>;
  /** The rules that apply to [[RelationshipConstraint]] objects. */
  relationshipConstraintRules?: Array<IRule<RelationshipConstraint>>;
  /** The rules that apply to [[CustomAttributeClass]] objects. */
  customAttributeClassRules?: Array<IRule<CustomAttributeClass>>;
  /** The rules that apply to [[CustomAttributeContainerProps]] objects. */
  customAttributeContainerRules?: Array<IRule<CustomAttributeContainerProps>>;
  /** The rules that apply to [[CustomAttribute]] objects. */
  customAttributeInstanceRules?: Array<BaseRule<CustomAttributeContainerProps, CustomAttribute>>;
  /** The rules that apply to [[Enumeration]] objects. */
  enumerationRules?: Array<IRule<Enumeration>>;
  /** The rules that apply to [[KindOfQuantity]] objects. */
  kindOfQuantityRules?: Array<IRule<KindOfQuantity>>;
  /** The rules that apply to [[PropertyCategory]] objects. */
  propertyCategoryRules?: Array<IRule<PropertyCategory>>;
  /** The rules that apply to [[Format]] objects. */
  formatRules?: Array<IRule<Format>>;
  /** The rules that apply to [[Unit]] objects. */
  unitRules?: Array<IRule<Unit>>;
  /** The rules that apply to [[InvertedUnit]] objects. */
  invertedUnitRules?: Array<IRule<InvertedUnit>>;
  /** The rules that apply to [[UnitSystem]] objects. */
  unitSystemRules?: Array<IRule<UnitSystem>>;
  /** The rules that apply to [[Phenomenon]] objects. */
  phenomenonRules?: Array<IRule<Phenomenon>>;
  /** The rules that apply to [[Constant]] objects. */
  constantRules?: Array<IRule<Constant>>;
}