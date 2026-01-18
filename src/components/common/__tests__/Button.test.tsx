/**
 * Button Component Snapshot Tests
 */

import React from 'react';
import renderer from 'react-test-renderer';
import { Button } from '../Button';

describe('Button Component Snapshots', () => {
  it('renders primary button correctly', () => {
    const tree = renderer
      .create(<Button title="Primary Button" onPress={() => { }} />)
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders outline button correctly', () => {
    const tree = renderer
      .create(<Button title="Outline Button" onPress={() => { }} variant="outline" />)
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders text button correctly', () => {
    const tree = renderer
      .create(<Button title="Text Button" onPress={() => { }} variant="ghost" />)
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders disabled button correctly', () => {
    const tree = renderer
      .create(<Button title="Disabled Button" onPress={() => { }} disabled />)
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders loading button correctly', () => {
    const tree = renderer
      .create(<Button title="Loading Button" onPress={() => { }} loading />)
      .toJSON();
    expect(tree).toMatchSnapshot();
  });
});
