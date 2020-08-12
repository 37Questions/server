import {AWSError} from "aws-sdk";
import {GetSecretValueResponse} from "aws-sdk/clients/secretsmanager";
import AWS from "aws-sdk";
import awsHelper from "./helper";

class SecretManager {
  manager: AWS.SecretsManager;

  constructor(region: string) {
    this.manager = new AWS.SecretsManager({
      region: region
    });
  }

  async get(id: string): Promise<string> {
    if (!awsHelper.isConnected) throw new Error("Invalid AWS Session");
    return new Promise((resolve, reject) => {
      this.manager.getSecretValue({SecretId: id}, (err: AWSError, data: GetSecretValueResponse) => {
        if (err) reject(err);
        else {
          if ('SecretString' in data) resolve(data.SecretString);
          else {
            let buff = new Buffer(data.SecretBinary as string, 'base64');
            resolve(buff.toString('ascii'));
          }
        }
      });
    })
  }

  getJson(secretArn: string): Promise<any> {
    return this.get(secretArn).then((secret) => JSON.parse(secret));
  }
}

const secrets = new SecretManager("ap-southeast-2");
export default secrets;