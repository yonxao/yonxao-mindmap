export type TopicAttributeValue = string | number | boolean | null | undefined;

export type TopicAttributes = Record<string, TopicAttributeValue>;

export interface MindTopic {
  id: string;
  text: string;
  attributes: TopicAttributes;
  subtopics: MindTopic[];
  line: number;
  level: number;
  _layout: unknown;
  _virtual: boolean;
}

export interface ParsedTopicLine {
  text: string;
  attributes: TopicAttributes;
}

export interface TopicLevelLine {
  level: number;
  text: string;
}

export type MindStructureType = 'relation' | 'summary' | 'boundary';

export type MindStructureAttributes = Record<string, string>;

export interface MindStructure {
  id: string;
  type: MindStructureType;
  topicIds: string[];
  text: string;
  attributes: MindStructureAttributes;
}

export interface MindStructureDocument {
  topicBody: string;
  structures: MindStructure[];
}

export interface SerializeMindStructuresOptions {
  saveFullConfig?: boolean;
}
