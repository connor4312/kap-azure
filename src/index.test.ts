import { BlobServiceClient, StorageSharedKeyCredential, BlobItem } from '@azure/storage-blob';
import { service, AzureConfig } from './';
import * as path from 'path';
import { stub } from 'sinon';
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';

describe('uploading', () => {
  let testClient: BlobServiceClient;
  const testContainer = 'kap-test';

  const az = (() => {
    const name = process.env.KAP_TEST_AZ_NAME;
    const key = process.env.KAP_TEST_AZ_KEY;

    if (!name || !key) {
      throw new Error(`Missing environment vars for KAP_TEST_AZ_NAME or KAP_TEST_AZ_KEY`);
    }

    return { name, key };
  })();

  const listBlobs = async () => {
    const iterator = await testClient
      .getContainerClient(testContainer)
      .listBlobsFlat()
      .byPage({ maxPageSize: 10 })
      .next();

    return iterator.value.segment.blobItems as BlobItem[];
  };

  const cleanup = async () => {
    const blobs = await listBlobs();
    for (const blob of blobs) {
      await testClient.getContainerClient(testContainer).deleteBlob(blob.name);
    }
  };

  before(() => {
    testClient = new BlobServiceClient(
      `https://${az.name}.blob.core.windows.net`,
      new StorageSharedKeyCredential(az.name, az.key),
    );
  });

  after(() => testClient.getContainerClient(testContainer).delete());

  const testImage = path.resolve(__dirname, '..', 'test.gif');
  const testImageMd5 = createHash('md5')
    .update(readFileSync(testImage))
    .digest();

  const baseMockConfig: AzureConfig = {
    accountName: az.name,
    accountKey: az.key,
    container: testContainer,
    filePattern: '',
    urlPattern: '',
  };

  const makeMockContext = (config: Partial<AzureConfig> = {}) => ({
    format: 'gif',
    defaultFileName: 'test.gif',
    filePath: () => Promise.resolve(testImage),
    request: stub(),
    copyToClipboard: stub(),
    notify: stub(),
    setProgress: stub(),
    openConfigFile: stub(),
    cancel: stub(),
    config: {
      get: <K extends keyof AzureConfig>(key: K): AzureConfig[K] =>
        config[key] ?? baseMockConfig[key],
    },
  });

  describe('base case', () => {
    const context = makeMockContext({});
    after(cleanup);

    before(async () => {
      await service.action(context);
    });

    it('creates the blob', async () => {
      const [blob] = await listBlobs();

      expect(blob.name).to.equal('test.gif');
      expect(blob.properties.contentType).to.equal('image/gif');
      expect(blob.properties.contentMD5).to.deep.equal(testImageMd5);
    });

    it('updates progress while uploading', () => {
      const progress = context.setProgress.args.map(a => a[1]);
      expect(progress.length).to.be.greaterThan(1);
      for (const percentage of progress) {
        expect(percentage).to.be.gte(0);
        expect(percentage).to.be.lte(1);
      }
    });

    it('copies the url', () => {
      const url = context.copyToClipboard.args[0][0];
      expect(url).to.equal(`https://${az.name}.blob.core.windows.net/${testContainer}/test.gif`);
      expect(context.notify.args[0][0]).to.match(/copied to the clipboard/);
    });
  });

  it('allows fancy template strings', async () => {
    after(cleanup);

    const context = makeMockContext({
      filePattern: '{basename}/{uuid}_{date:YYYY}_{random:8}_{invalid}.{ext}',
      urlPattern: 'https://example.com/{filename}',
    });

    await service.action(context);

    const [blob] = await listBlobs();

    // todo: update this regex by 2030
    expect(blob.name).to.match(
      /test\/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}_202[0-9]_[0-9a-f]{8}_{invalid}\.gif/,
    );

    const url = context.copyToClipboard.args[0][0];
    expect(url).to.equal(`https://example.com/${blob.name}`);
  });
});
