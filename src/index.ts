import { KapShareService, KapContext } from 'kap';
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import * as path from 'path';
import * as fs from 'fs';
import dayjs from 'dayjs';
import uuid from 'uuid/v4';
import { randomBytes } from 'crypto';
import { promisify } from 'util';

type TemplateMap = { [key: string]: (arg?: string) => string };

const contentTypes: ReadonlyMap<string, string> = new Map([
  ['gif', 'image/gif'],
  ['mp4', 'video/mp4'],
  ['webm', 'video/webm'],
  ['apng', 'image/apng'],
]);

const defaultUrlPattern = `https://{accountName}.blob.core.windows.net/{container}/{filename}`;

const stat = promisify(fs.stat);

const templateString = (input: string, replacers: TemplateMap) =>
  input.replace(/{.*?}/g, match => {
    const [key, arg] = match.slice(1, -1).split(':');
    return replacers.hasOwnProperty(key) ? replacers[key](arg ? arg.trim() : undefined) : match;
  });

export interface AzureConfig {
  accountName: string;
  accountKey: string;
  container: string;
  filePattern?: string;
  urlPattern?: string;
}

const action = async (context: KapContext<AzureConfig>) => {
  const filePath = await context.filePath();

  const templateItems: TemplateMap = {
    accountName: () => context.config.get('accountName'),
    container: () => context.config.get('container'),
    basename: () => path.basename(filePath, path.extname(filePath)),
    ext: () => path.extname(filePath).slice(1),
    uuid: () => uuid(),
    kapName: () => context.defaultFileName,
    date: (format = 'YYYY-MM-DDTHH:mm:ssZ') => dayjs().format(format),
    random: (chars = '16') => {
      const n = Number(chars) || 16;
      return randomBytes(Math.ceil(n / 2))
        .toString('hex')
        .slice(0, n);
    },
  };

  const blobServiceClient = new BlobServiceClient(
    `https://${context.config.get('accountName')}.blob.core.windows.net`,
    new StorageSharedKeyCredential(
      context.config.get('accountName'),
      context.config.get('accountKey'),
    ),
  );

  // 2. Create the container (no-op if it already exists)
  const containerClient = blobServiceClient.getContainerClient(context.config.get('container'));
  try {
    await containerClient.create({ access: 'blob' });
  } catch (err) {
    if (err.statusCode !== 409) {
      throw err;
    }

    // otherwise, already exists, no problem!
  }

  // 3. Upload the file to the container
  const filename = templateString(context.config.get('filePattern') || '{kapName}', templateItems);
  templateItems.filename = () => filename;

  const blobClient = containerClient.getBlockBlobClient(filename);
  const { size } = await stat(filePath);
  await blobClient.uploadFile(filePath, {
    blobHTTPHeaders: {
      blobContentType: contentTypes.get(context.format),
    },
    onProgress: evt => {
      context.setProgress('Uploading...', evt.loadedBytes / size);
    },
  });

  // 4. Generate and return the URL
  const url = templateString(context.config.get('urlPattern') || defaultUrlPattern, templateItems);
  context.copyToClipboard(url);
  context.notify('Blob URL copied to the clipboard');
};

export const service: KapShareService = {
  title: 'Azure Storage',
  formats: [...contentTypes.keys()],
  action,
  config: {
    accountName: {
      title: 'Storage Account Name',
      type: 'string',
      default: '',
      required: true,
    },
    accountKey: {
      title: 'Storage Account Key',
      type: 'string',
      default: '',
      required: true,
    },
    container: {
      title: 'Container',
      type: 'string',
      default: 'kap',
      required: true,
    },
    filePattern: {
      title: 'File Name Pattern',
      description:
        'Pattern that determines how files are named. Possible segments are: {kapName}, {basename}, {ext}, {uuid}, {date:<day.js format>}, {random:<chars>}.',
      type: 'string',
      default: '{kapName}',
    },
    urlPattern: {
      title: 'URL Pattern',
      description: `URL where uploaded files can be found. Defaults to ${defaultUrlPattern}.`,
      type: 'string',
      default: '',
    },
  },
};

export const shareServices = [service];
