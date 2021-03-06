/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import { FeatureAppearanceProps, RgbColorProps, FeatureAppearance } from "@bentley/imodeljs-common";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority, Tool, Viewport } from "@bentley/imodeljs-frontend";
import { copyStringToClipboard } from "../ClipboardUtilities";
import { parseBoolean } from "./parseBoolean";


/** @alpha */
export class AttachRealityModelTool extends Tool {
  public static toolId = "AttachRealityModelTool";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 1; }

  public run(data: string): boolean {
    const props = JSON.parse(data);
    const vp = IModelApp.viewManager.selectedView;
    if (vp === undefined)
      return false;

    if (props === undefined || props.tilesetUrl === undefined) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, `Properties ${props} are not valid`));
    }

    vp.displayStyle.attachRealityModel(props);
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Reality Model ${props.tilesetUrl} attached`));
    vp.invalidateRenderPlan();

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run(args[0]);
  }
}

/** @alpha */
export class SaveRealityModelTool extends Tool {
  public static toolId = "SaveRealityModelTool";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  public run(name: string | undefined): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (vp === undefined)
      return false;
    vp.displayStyle.forEachRealityModel((realityModel) => {
      if (name === undefined || realityModel.name === name) {
        copyStringToClipboard(JSON.stringify(realityModel.toJSON()));
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Reality Model ${realityModel.name} copied to clipboard`));
      }
    });

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run(args.length > 0 ? args[0] : undefined);
  }
}

function changeRealityModelAppearanceOverrides(vp: Viewport, overrides: FeatureAppearanceProps, index: number): boolean {
  const existingOverrides = vp.getRealityModelAppearanceOverride(index);
  return vp.overrideRealityModelAppearance(index, existingOverrides ? existingOverrides.clone(overrides) : FeatureAppearance.fromJSON(overrides));
}


/** Set reality model appearance override for transparency in display style.
 * @beta
 */
export class SetRealityModelTransparencyTool extends Tool {
  public static toolId = "SetRealityModelTransparencyTool";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 2; }

  public run(transparency: number, index: number): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (vp === undefined)
      return false;

    const changed = changeRealityModelAppearanceOverrides(vp, { transparency }, index);

    if (changed)
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Reality Model at Index: ${index} set to transparency: ${transparency}`));

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run(parseFloat(args[0]), args.length > 1 ? parseInt(args[1], 10) : -1);
  }
}
/** Set reality model appearance override for locatable in display style.
 * @beta
 */
export class SetRealityModelLocateTool extends Tool {
  public static toolId = "SetRealityModelLocateTool";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 2; }

  public run(locate: boolean, index: number): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (vp === undefined)
      return false;

    const nonLocatable = locate ? undefined : true;
    const changed = changeRealityModelAppearanceOverrides(vp, { nonLocatable }, index);

    if (changed)
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Reality Model at Index: ${index} set to locate: ${locate}`));

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const locate = parseBoolean(args[0]);
    return locate === undefined ? false : this.run(locate, args.length > 1 ? parseInt(args[1], 10) : -1);
  }
}

/** Set reality model appearance override for emphasized in display style.
 * @beta
 */
export class SetRealityModelEmphasizedTool extends Tool {
  public static toolId = "SetRealityModelEmphasizedTool";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 2; }

  public run(emphasized: true | undefined, index: number): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (vp === undefined)
      return false;

    const changed = changeRealityModelAppearanceOverrides(vp, { emphasized }, index);

    if (changed)
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Reality Model at Index: ${index} set to emphasized: ${emphasized}`));

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const emphasized = parseBoolean(args[0]);
    return emphasized === undefined ? false : this.run(emphasized ? true : undefined, args.length > 1 ? parseInt(args[1], 10) : -1);
  }
}

/** Set reality model appearance override for color in display style.
 * @beta
 */
export class SetRealityModelColorTool extends Tool {
  public static toolId = "SetRealityModelColorTool";
  public static get minArgs() { return 3; }
  public static get maxArgs() { return 4; }

  public run(rgb: RgbColorProps, index: number): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (vp === undefined)
      return false;

    const changed = changeRealityModelAppearanceOverrides(vp, { rgb }, index);

    if (changed)
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Reality Model at Index: ${index} set to color: ${rgb}`));

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run({ r: parseFloat(args[0]), g: parseFloat(args[1]), b: parseFloat(args[2]) }, args.length > 3 ? parseInt(args[3], 10) : -1);
  }
}

/** Clear reality model appearance override in display style.
 * @beta
 */
export class ClearRealityModelAppearanceOverrides extends Tool {
  public static toolId = "ClearRealityModelAppearanceOverrides";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  public run(index: number): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (vp)
      vp.dropRealityModelAppearanceOverride(index);

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run(args[0] === undefined ? -1 : parseInt(args[0], 10));
  }
}
