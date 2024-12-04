import { loadOptions } from "@babel/core";
import axios from "axios";
import {
  IDataObject,
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
} from "n8n-workflow";

export class RunApeModel implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Run Ape Model",
    name: "runApeModel",
    icon: "file:ape.png",
    group: ["transform"],
    version: 1,
    description: "Calls a model function from Ape Analytics",
    defaults: {
      name: "Run Ape Model",
      color: "#772244",
    },
    inputs: ["main"],
    outputs: ["main"],
    credentials: [],
    properties: [
      {
        displayName: "Collection Name",
        name: "collectionName",
        type: "options",
        default: "",
        typeOptions: {
          loadOptionsMethod: "getCollections",
        },
        description: 'The collection name to use, e.g., "Solana"',
      },
      {
        displayName: "Model Name",
        name: "modelName",
        type: "options",
        typeOptions: {
          loadOptionsMethod: "getModels",
        },
        default: "",
        description: 'The model name to use, e.g., "TokenAnalytics"',
      },
      {
        displayName: "Function Name",
        name: "functionName",
        type: "options",
        typeOptions: {
          loadOptionsMethod: "getFunctions",
        },
        default: "",
        description: 'The function name to call, e.g., "get_top_whales"',
      },
      {
        displayName: "Data",
        name: "jsonData",
        type: "json",
        default: "{}",
        description: "JSON data to send with the POST request",
      },
    ],
  };

  methods = {
    loadOptions: {
      async getCollections(
        this: ILoadOptionsFunctions,
      ): Promise<INodePropertyOptions[]> {
        const collections = await axios.get(
          process.env.API_BASE_URL + "/metadata",
        );
        if (!collections.data) {
          return [];
        }
        return Object.entries(collections.data).map(
          ([collectionName, model]) => ({
            name: collectionName,
            value: collectionName,
          }),
        );
      },
      async getModels(
        this: ILoadOptionsFunctions,
      ): Promise<INodePropertyOptions[]> {
        const collectionName = this.getCurrentNodeParameter(
          "collectionName",
        ) as string;
        const collections = await axios.get(
          process.env.API_BASE_URL + "metadata",
        );
        if (!collections.data[collectionName]) {
          return [];
        }
        return Object.entries(collections.data[collectionName]).map(
          ([modelName, modelFunctionName]) => ({
            name: modelName,
            value: modelName,
          }),
        );
      },
      async getFunctions(
        this: ILoadOptionsFunctions,
      ): Promise<INodePropertyOptions[]> {
        const collectionName = this.getCurrentNodeParameter(
          "collectionName",
        ) as string;
        const modelName = this.getCurrentNodeParameter("modelName") as string;
        const functions = await axios.get(
          process.env.API_BASE_URL + "metadata",
        );
        if (!functions.data[collectionName][modelName]) {
          return [];
        }
        return functions.data[collectionName][modelName].map(
          (functionName: string) => ({
            name: functionName,
            value: functionName,
          }),
        );
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const collectionName = this.getNodeParameter(
        "collectionName",
        i,
      ) as string;
      const modelName = this.getNodeParameter("modelName", i) as string;
      const functionName = this.getNodeParameter("functionName", i) as string;
      const jsonData = this.getNodeParameter("jsonData", i, {}) as IDataObject; // Default to an empty object if not provided

      const url = `${process.env.API_BASE_URL}/${collectionName}/${modelName}/${functionName}`;

      try {
        const response = await axios.post(url, jsonData); // Include jsonData in the POST request
        returnData.push({ json: response.data });
      } catch (error) {
        throw new Error(`Failed to fetch data: ${error.message}`);
      }
    }

    return [returnData];
  }
}
