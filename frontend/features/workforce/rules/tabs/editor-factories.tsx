'use client';

import * as React from 'react';

import { ChoiceEditor, type ChoiceConfig } from '../change/choice-editor';
import { NumbersEditor, type NumbersConfig } from '../change/number-editor';
import type { EditorProps } from './tab-types';

/** Turn a config into the component a row definition names as its `Editor`. */
export function numbersEditor(config: NumbersConfig): React.ComponentType<EditorProps> {
  return function RowNumbersEditor(props: EditorProps) {
    return <NumbersEditor config={config} {...props} />;
  };
}

export function choiceEditor(config: ChoiceConfig): React.ComponentType<EditorProps> {
  return function RowChoiceEditor(props: EditorProps) {
    return <ChoiceEditor config={config} {...props} />;
  };
}
