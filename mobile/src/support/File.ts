export class File {
  readonly fileUri: string;
  private _isOpen: boolean;

  constructor(fileUri: string) {
    this.fileUri = fileUri;
    this._isOpen = true;
  }

  isOpen() {
    return this._isOpen;
  }

  close() {
    this._isOpen = false;
  }
}
