import {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from "n8n-workflow";

export class RandomNumberGenerator implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Random Number Generator",
    name: "randomNumberGenerator",
    group: ["transform"],
    version: 1,
    description:
      "Generates a random number between specified minimum and maximum values",
    defaults: {
      name: "Random Number Generator",
    },
    inputs: ["main"],
    outputs: ["main"],
    properties: [
      {
        displayName: "Minimum Possible Value",
        name: "minPossibleValue",
        type: "number",
        default: 0,
        description:
          "The minimum value in the range from which to generate a random number",
      },
      {
        displayName: "Maximum Possible Value",
        name: "maxPossibleValue",
        type: "number",
        default: 100,
        description:
          "The maximum value in the range from which to generate a random number",
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    let outputItems: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      const minPossibleValue = this.getNodeParameter(
        "minPossibleValue",
        itemIndex,
        0,
      ) as number;
      const maxPossibleValue = this.getNodeParameter(
        "maxPossibleValue",
        itemIndex,
        100,
      ) as number;

      if (minPossibleValue > maxPossibleValue) {
        throw new NodeOperationError(
          this.getNode(),
          "Minimum possible value must be less than or equal to the maximum possible value",
          { itemIndex },
        );
      }

      const randomNumber = Math.floor(
        Math.random() * (maxPossibleValue - minPossibleValue + 1) +
          minPossibleValue,
      );

      // Prepare the output data
      outputItems.push({
        json: {
          minPossibleValue,
          maxPossibleValue,
          randomNumber,
        },
      });
    }

    return [outputItems];
  }
}
