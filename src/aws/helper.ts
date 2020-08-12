class AWSHelper {
  get isConnected(): boolean {
    return !!process.env.AWS_ACCESS_KEY_ID;
  }
}

const awsHelper = new AWSHelper();
export default awsHelper;