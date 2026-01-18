/**
 * Toast Component Snapshot Tests
 */

import React from 'react';
import renderer from 'react-test-renderer';
import { Toast } from '../Toast';

describe('Toast Component Snapshots', () => {
  it('renders success toast correctly', () => {
    const tree = renderer
      .create(
        <Toast
          message="操作が成功しました"
          type="success"
          visible={true}
          onDismiss={() => { }}
        />
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders error toast correctly', () => {
    const tree = renderer
      .create(
        <Toast
          message="エラーが発生しました"
          type="error"
          visible={true}
          onDismiss={() => { }}
        />
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders warning toast correctly', () => {
    const tree = renderer
      .create(
        <Toast
          message="警告メッセージ"
          type="warning"
          visible={true}
          onDismiss={() => { }}
        />
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders info toast correctly', () => {
    const tree = renderer
      .create(
        <Toast
          message="情報メッセージ"
          type="info"
          visible={true}
          onDismiss={() => { }}
        />
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders hidden toast correctly', () => {
    const tree = renderer
      .create(
        <Toast
          message="非表示"
          type="success"
          visible={false}
          onDismiss={() => { }}
        />
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });
});
