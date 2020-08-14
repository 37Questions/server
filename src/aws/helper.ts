class AWSHelper {
  get isConnected(): boolean {
    return !!process.env.AWS_ACCESS_KEY_ID;
  }

  get isProductionEnv(): boolean {
    return process.env.NODE_ENV === "production";
  }
}

const awsHelper = new AWSHelper();
export default awsHelper;