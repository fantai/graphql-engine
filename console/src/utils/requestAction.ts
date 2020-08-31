import { push } from 'react-router-redux';
// @ts-ignore
import { m3b272a70, base64 } from '@fantai/enclib/dist/ftenclib';
import globals from '../Globals';
import { Thunk } from '../types';
import dataHeaders from '../components/Services/Data/Common/Headers';

import {
  LOAD_REQUEST,
  DONE_REQUEST,
  FAILED_REQUEST,
  ERROR_REQUEST,
  CONNECTION_FAILED,
} from '../components/App/Actions';
import { globalCookiePolicy } from '../Endpoints';

const FT_SESSION = '3b272a70';

const skipEncrypt = window.location.search.indexOf('encrypt=false') >= 0;

function base64BytesToString(bytes: number[]) {
  // return bytes.map(function(eachByte) {
  //   return String.fromCodePoint(eachByte);
  // }).join('');
  const length = bytes.length;
  if (length > 65535) {
    let start = 0;
    const results = [];
    do {
      const subArray = bytes.slice(start, start += 65535);
      results.push(String.fromCodePoint.apply(null, subArray));
    } while (start < length);
    return results.join('');
  } else {
    return String.fromCodePoint.apply(null, bytes);
  }
}

export function wrapRequest(request: any) {
  if (!skipEncrypt) {
    const b64 = skipEncrypt ? undefined : base64BytesToString(base64(JSON.stringify({
      m: FT_SESSION,
    })));
    request.headers = {
      ...request.headers,
      'ft-session': b64,
    };
    const isPost = (request.method || '').toLowerCase() === 'post';
    const encrypt = m3b272a70;
    if (isPost) {
      // 加密请求
      request.body = base64BytesToString(encrypt(request.body || ''));
    }
  }
}

const requestAction = (
  url: string,
  options: RequestInit = {},
  SUCCESS?: string,
  ERROR?: string,
  includeCredentials = true,
  includeAdminHeaders = false
): Thunk<Promise<any>> => {
  return (dispatch: any, getState: any) => {
    const requestOptions = { ...options };

    if (!options.credentials && includeCredentials) {
      requestOptions.credentials = globalCookiePolicy;
    }

    if (includeAdminHeaders) {
      requestOptions.headers = {
        ...(options.headers || {}),
        ...dataHeaders(getState),
      };
    }
    return new Promise((resolve, reject) => {
      dispatch({ type: LOAD_REQUEST });
      wrapRequest(requestOptions);
      fetch(url, requestOptions).then(
          response => {
            if (response.ok) {
              return response.json().then(results => {
                if (SUCCESS) {
                  dispatch({ type: SUCCESS, data: results });
                }
                dispatch({ type: DONE_REQUEST });
                resolve(results);
              });
            }
            dispatch({ type: FAILED_REQUEST });
            if (response.status >= 400 && response.status <= 500) {
              return response.json().then(errorMsg => {
                const msg = errorMsg;
                if (ERROR) {
                  dispatch({ type: ERROR, data: msg });
                } else {
                  dispatch({
                    type: ERROR_REQUEST,
                    data: msg,
                    url,
                    params: options.body,
                    statusCode: response.status,
                  });
                }
                if (msg.code && msg.code === 'access-denied') {
                  if (window.location.pathname !== `${globals.urlPrefix}/login`) {
                    dispatch(push(`${globals.urlPrefix}/login`));
                  }
                }
                reject(msg);
              });
            }
            return response.text().then(errorMsg => {
              dispatch({ type: FAILED_REQUEST });
              if (ERROR) {
                dispatch({ type: ERROR, response, data: errorMsg });
              }
              reject();
            });
          },
          error => {
            console.error('Request error: ', error);
            dispatch({ type: CONNECTION_FAILED });
            if (ERROR) {
              dispatch({
                type: ERROR,
                message: error.message,
                data: error.message,
              });
            }
            reject(error);
          }
      );
    });
  };
};

export default requestAction;
