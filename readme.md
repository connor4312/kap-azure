# kap-azure

> [Kap](https://github.com/wulkano/kap) plugin - Upload recordings to Azure (Blob) Storage

## Install

In the `Kap` menu, go to `Preferences…`, select the `Plugins` pane, find this plugin, and toggle it. Click the "edit" icon, and enter your account details.

### Configuration

- `accountName`, and `accountKey` are self-explanitory. These are on the Azure portal.
- `container` to upload to. This will be created if it doesn't exist.
- `filePattern` optionally configures the uploaded path. Defaults to `{kapName}`, but you can do complex things like `subdirectory/{date:YYYY}-{uuid}.{ext}`. Placeholders:
  - `{accountName}` is the blob storage account name.
  - `{kapName}` is the original filename from Kap.
  - `{basename}` is the original filename, minus its extension. The `foo` in `foo.gif`.
  - `{ext}` is the original extension. The `gif` in `foo.gif`.
  - `{uuid}` creates a UUID.
  - `{date:<format>}` formats the current date using a [day.js format string](https://github.com/iamkun/dayjs/blob/144c2ae6e15fbf89e3acd7c8cb9e237c5f6e1348/docs/en/API-reference.md#format-formatstringwithtokens-string). For example, `{date:YYYY}`.
  - `{random:<chars>}` creates a number of random hex characters. For example, `{random:7}` might output `badf00d`.
- `urlPattern` is the pattern copied to your clipboard. All the same placeholders above work, as well as `{filename}`, which is the output from the `filePattern`.

## Usage

In the editor, after recording, select `Azure Storage`, and then hit `Export`.
