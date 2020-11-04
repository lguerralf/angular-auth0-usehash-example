import * as cdk from '@aws-cdk/core';
import * as cloudfront from "@aws-cdk/aws-cloudfront";
import * as s3 from "@aws-cdk/aws-s3";
import * as acm from "@aws-cdk/aws-certificatemanager";
import * as route53 from "@aws-cdk/aws-route53";
import targets = require("@aws-cdk/aws-route53-targets/lib");
import * as s3deploy from "@aws-cdk/aws-s3-deployment";

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const siteDomain = "demo-test.dev.platform.linuxfoundation.org";

    const myHostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'zonelookup', {
      hostedZoneId: 'Z2WMPS94V5T2UC',
      zoneName: 'dev.platform.linuxfoundation.org'
    })

    const certificate = new acm.Certificate(this, "Certificate", {
      domainName: siteDomain,
      validation: acm.CertificateValidation.fromDns(myHostedZone),
    });

    // Content bucket
    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      bucketName: siteDomain,
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "error.html",
      publicReadAccess: true,

      // The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
      // the new bucket, and it will remain in your account until manually deleted. By setting the policy to
      // DESTROY, cdk destroy will attempt to delete the bucket, but will error if the bucket is not empty.
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production code
    });
    new cdk.CfnOutput(this, "Bucket", { value: siteBucket.bucketName });

    // CloudFront distribution that provides HTTPS
    const distribution = new cloudfront.CloudFrontWebDistribution(this, "SiteDistribution", {
      aliasConfiguration: {
        acmCertRef: certificate.certificateArn,
        names: [siteDomain],
        sslMethod: cloudfront.SSLMethod.SNI,
        securityPolicy: cloudfront.SecurityPolicyProtocol.TLS_V1_1_2016,
      },
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: siteBucket,
          },
          behaviors: [{ isDefaultBehavior: true }],
        },
      ],
    });
    new cdk.CfnOutput(this, "DistributionId", { value: distribution.distributionId });

    new route53.ARecord(this, "SiteAliasRecord", {
      recordName: siteDomain,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution)
      ),
      zone: myHostedZone,
    });

    new cdk.CfnOutput(this, "website domain", {
      value: siteDomain
    });

    // Deploy site contents to S3 bucket
    new s3deploy.BucketDeployment(this, "DeployWithInvalidation", {
      sources: [s3deploy.Source.asset("../frontend/dist/auth-angular-hash-spa-auth0-example")],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ["/*"],
    });
  }
}
