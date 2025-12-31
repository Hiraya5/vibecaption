
export interface CaptionResults {
  short: string;
  medium: string;
  detailed: string;
}

export interface ImageAnalysis {
  id: string;
  imageData: string;
  captions: CaptionResults;
  timestamp: number;
}
