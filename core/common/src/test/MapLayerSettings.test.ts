/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { BackgroundMapSettings, BackgroundMapType } from "../BackgroundMapSettings";
import { MapLayerProps, MapLayerSettings, MapSubLayerProps, MapSubLayerSettings } from "../imodeljs-common";

const testMapSubLayer0 = { name: "TestName", title: "TestTitle", visible: true };
const testMapSubLayer1 = { name: "TestName", title: "TestTitle", visible: true, id: 0, parent: -1, children: [1, 2, 3] };

describe("MapSubLayerSettings", () => {
  const expectMatch = (output: MapSubLayerProps, expected: MapSubLayerProps) => {
    expect(output.id).to.equal(expected.id);
    expect(output.name).to.equal(expected.name);
    expect(output.title).to.equal(expected.title);
    expect(output.parent).to.equal(expected.parent);
    expect(output.visible).to.equal(expected.visible);

    if (expected.children) {
      expect(output.children).not.to.be.undefined;
      expect(expected.children.length).to.equal(output.children!.length);
      for (let i = 0; i < expected.children.length; i++)
        expect(expected.children[i]).to.equal(output.children![i]);
    }

  };

  it("round-trips through JSON", () => {
    const roundTrip = (input: MapSubLayerProps | undefined, expected: MapSubLayerProps | "input") => {
      if (!input)
        input = {};

      if ("input" === expected)
        expected = JSON.parse(JSON.stringify(input)) as MapSubLayerProps;
      const settings = MapSubLayerSettings.fromJSON(input)!;
      expect(settings).not.to.be.undefined;
      const output = settings.toJSON();
      expectMatch(output, expected);
    };
    roundTrip(testMapSubLayer0, "input");
    roundTrip(testMapSubLayer1, "input");
  });

  it("clones", () => {
    const clone = (input: MapSubLayerProps, changed: MapSubLayerProps, expected: MapSubLayerProps) => {
      const settings = MapSubLayerSettings.fromJSON(input);
      const output = settings!.clone(changed);
      expectMatch(output.toJSON(), expected);
    };

    // Turn off visibility
    clone(testMapSubLayer0, { visible: false }, { name: "TestName", title: "TestTitle", visible: false });
    clone(testMapSubLayer1, { visible: false }, { name: "TestName", title: "TestTitle", visible: false, id: 0, parent: -1, children: [1, 2, 3] });
  });
});

const testMapLayer0 = { name: "TestName", url: "www.bentley.com", formatId: "WMS" };
const testMapLayer1 = { name: "TestName", url: "www.bentley.com", formatId: "WMTS", transparency: .5, transparentBackground: false };
const testMapLayer2 = { name: "TestName", url: "www.bentley.com", formatId: "WMS", subLayers: [testMapSubLayer0, testMapSubLayer1] };
const testMapLayer3 = { name: "TestName", url: "www.bentley.com", formatId: "WMS", userName: "TestUser", password: "TestPassword", subLayers: [testMapSubLayer0, testMapSubLayer1] };
const testMapLayer4 = { name: "TestName", url: "www.bentley.com", formatId: "WMS", userName: "TestUser", password: "TestPassword", subLayers: [testMapSubLayer0, testMapSubLayer1], isBase: true };
const legacyMapLayer = MapLayerSettings.fromMapSettings(BackgroundMapSettings.fromJSON({ providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Hybrid } }));

describe("MapLayerSettings", () => {
  const expectMatches = (output: MapLayerProps, expected: MapLayerProps) => {
    expect(output.name).to.equal(expected.name);
    expect(output.visible).to.equal(expected.visible);
    expect(output.url).to.equal(expected.url);
    expect(output.transparency).to.equal(expected.transparency);
    expect(output.transparentBackground).to.equal(expected.transparentBackground);
    expect(output.isBase).to.equal(expected.isBase);
    expect(output.userName).to.equal(expected.userName);
    expect(output.password).to.equal(expected.password);

    if (expected.subLayers) {
      expect(output.subLayers).not.to.be.undefined;
      expect(expected.subLayers.length).to.equal(output.subLayers!.length);
      for (let i = 0; i < expected.subLayers.length; i++)
        expect(JSON.stringify(expected.subLayers[i])).to.equal(JSON.stringify(output.subLayers![i]));
    }
  };

  it("round-trips through JSON", () => {
    const roundTrip = (input: MapLayerProps | undefined, expected: MapLayerProps | "input") => {
      if (!input)
        input = {};

      if ("input" === expected)
        expected = JSON.parse(JSON.stringify(input)) as MapLayerProps;

      const settings = MapLayerSettings.fromJSON(input)!;
      expect(settings).not.to.be.undefined;
      const output = settings.toJSON();
      expectMatches(output, expected);
    };

    roundTrip(testMapLayer0, "input");
    roundTrip(testMapLayer1, "input");
    roundTrip(testMapLayer2, "input");
    roundTrip(testMapLayer3, "input");
    roundTrip(testMapLayer4, "input");
    roundTrip(legacyMapLayer, "input");
  });

  it("clones", () => {
    const clone = (input: MapLayerProps, changed: MapLayerProps, expected: MapLayerProps) => {
      const settings = MapLayerSettings.fromJSON(input);
      const output = settings!.clone(changed);
      expectMatches(output.toJSON(), expected);
    };

    // Turn off visibility
    clone(testMapLayer0, { visible: false }, { name: "TestName", url: "www.bentley.com", formatId: "WMS", visible: undefined });
    clone(testMapLayer3, { visible: false }, { name: "TestName", url: "www.bentley.com", formatId: "WMS", userName: "TestUser", password: "TestPassword", subLayers: [testMapSubLayer0, testMapSubLayer1], visible: undefined });

    // Set transparency
    clone(testMapLayer0, { transparency: .5 }, { name: "TestName", url: "www.bentley.com", formatId: "WMS", transparency: .5 });
    clone(testMapLayer3, { transparency: .5 }, { name: "TestName", url: "www.bentley.com", formatId: "WMS", userName: "TestUser", password: "TestPassword", subLayers: [testMapSubLayer0, testMapSubLayer1], transparency: .5 });
  });
});
