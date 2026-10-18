// @vitest-environment node
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';
import { useImageLoadState, useImageLoadStates, useViewportState } from './index';
import { useActiveTool, useAnnotations } from './tools/index';
import { imageBindings } from './useImageLoadState';
import { viewportBindings } from './useViewportState';
import { activeToolBindings } from './tools/useActiveTool';
import { annotationBindings } from './tools/useAnnotations';

// src/ssr.test.ts runs in jsdom, where `window` exists; this is a real server.
// A server render never commits, so nothing would ever unsubscribe a Binding
// it registered: the registries must stay empty however many pages render.
test('server renders leave no Binding in any registry', () => {
  expect(typeof window).toBe('undefined');
  const Page = () => {
    useViewportState('vp');
    useImageLoadState('img:a');
    useImageLoadStates(['img:a', 'img:b']);
    useActiveTool('vp');
    useAnnotations('vp');
    return null;
  };
  renderToString(createElement(Page));
  renderToString(createElement(Page));
  expect(imageBindings.size).toBe(0);
  expect(viewportBindings.size).toBe(0);
  expect(activeToolBindings.size).toBe(0);
  expect(annotationBindings.size).toBe(0);
});
