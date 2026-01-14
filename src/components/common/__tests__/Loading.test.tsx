/**
 * Loading Component Snapshot Tests
 */

import React from 'react';
import renderer from 'react-test-renderer';
import { Loading } from '../Loading';

describe('Loading Component Snapshots', () => {
  it('renders default loading state correctly', () => {
    const tree = renderer.create(<Loading />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders with custom message correctly', () => {
    const tree = renderer.create(<Loading message="読み込み中..." />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders fullscreen loading correctly', () => {
    const tree = renderer.create(<Loading fullScreen />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders fullscreen with message correctly', () => {
    const tree = renderer
      .create(<Loading fullScreen message="データを処理中..." />)
      .toJSON();
    expect(tree).toMatchSnapshot();
  });
});
