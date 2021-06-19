import {
  Observable,
  Subscriber,
  bindCallback,
  connectable,
  EMPTY,
  from,
  zip,
  of,
  iif,
  throwError,
  concat,
} from "rxjs";
import {
  concatAll,
  concatMap,
  filter,
  map,
  switchMap,
  take,
  tap,
  toArray,
} from "rxjs/operators";

declare var wx: any;

/**
 * 要使用的接口列表
 */
const jsApiList = [
  "getLocalImgData",
  "chooseImage",
  'uploadImage',
  "openLocation",
  "getLocation",
  "startRecord",
  "stopRecord",
  "onVoiceRecordEnd",
  "uploadVoice",
  "playVoice",
  "stopVoice",
  "onVoicePlayEnd",
];

/**
 * 微信JSSDK服务
 */
export class WxSDKService {
  /**
   * 当前SDK 是否可用
   */
  private ready: Promise<boolean> | null = null;
  private readonly SDK_ERROR = "SDK 暂不能使用";

  /**
   * 使用jsSDK
   * 如果url变化之后，需要重新调用，同一个页面只需要调用一次
   * @param timestamp
   * @param nonceStr
   * @param signature
   * @returns
   */
  private useJssdk() {
    /* DEBUGGER */
    // const service = new WxAuthService();
    // const param = new RequestParams({
    // 	url: window.location.href,
    // });
    // service.getUserInfo(param).subscribe({
    // 	next: ({ timestamp, nonceStr, signature }) => {
    // 		wx.config({
    // 			beta: true, // 必须这么写，否则wx.invoke调用形式的jsapi会有问题
    // 			debug: true, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
    // 			appId: import.meta.env.VITE_APP_CORPID, // 必填，企业微信的corpID
    // 			timestamp, // 必填，生成签名的时间戳
    // 			nonceStr, // 必填，生成签名的随机串
    // 			signature, // 必填，签名，见 附录-JS-SDK使用权限签名算法
    // 			jsApiList, // 必填，需要使用的JS接口列表，凡是要调用的接口都需要传进来
    // 		});
    // 	},
    // });

    // TEST
    wx.config({
      beta: true, // 必须这么写，否则wx.invoke调用形式的jsapi会有问题
      debug: false, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
      appId: "", // 必填，企业微信的corpID
      timestamp: "1624097744153", // 必填，生成签名的时间戳
      nonceStr: "xmgjyh", // 必填，生成签名的随机串
      signature: "c55ece02e82ba07cc1f30b961451e5bb44b36e20", // 必填，签名，见 附录-JS-SDK使用权限签名算法
      jsApiList, // 必填，需要使用的JS接口列表，凡是要调用的接口都需要传进来
    });

    return new Promise<boolean>((resolve, reject) => {
      // ready jssdk可以使用
      wx.ready(() => resolve(true));
      wx.error((res: any) => {
        reject(false);
        console.error(res.errMsg,'onError')
        throw res.errMsg;
      });
    });
  }

  private onReady() {
    if (!this.ready) {
      this.ready = this.useJssdk();
    }
    return this.ready;
  }

  private resOk(res: any): boolean {
    const errMsg: string = res.errMsg;
    if (!errMsg) return false;
    return /ok$/.test(errMsg);
  }

  private onCatch(subscriber: Subscriber<any>) {
    return subscriber.error(this.SDK_ERROR);
  }

  /**
   * 选择图片，并且上传
   * @param count 图片的数量,默认9张
   * @returns
   * @example
   *	const service = new WxSDKService();
   *	service.chooseImages(3).subscribe({
   *		next: (ImageData) => {
   *			// ImageData1
   *      // ImageData2
   *      // ...
   *		},
   *	});
   */
  public chooseImages(count = 9) {
    // 选图片
    const chooseImage$ = new Observable<string[]>((subscriber) => {
      wx.chooseImage({
        count,
        sizeType: ["original"],
        success: ({ errMsg, localIds }) => {
          errMsg && /ok$/.test(errMsg)
            ? subscriber.next(localIds)
            : subscriber.error(errMsg);
          //
          subscriber.complete();
        },
      });
    });

    // 获取图片数据
    const getImageData = (localId) =>
      new Observable<ImageData>((subscriber) => {
        wx.getLocalImgData({
          localId,
          success: ({ errMsg, localData }) => {
            errMsg && /ok$/.test(errMsg)
              ? subscriber.next({
                  localId,
                  data: localData,
                })
              : subscriber.error(errMsg);

            subscriber.complete();
          },
        });
      });

    return from(this.onReady()).pipe(
      filter((v) => !!v),
      switchMap(() => chooseImage$),
      switchMap(from),
      concatMap(getImageData)
    );
  }

  /**
   * 上传图片
   * @param localId
   * @returns
   */
  public uploadImage(localId: string) {
    return new Observable<UploadInfo>((subscriber) => {
      wx.uploadImage({
        localId,
        isShowProgressTips: 0,
        success: ({ errMsg, serverId }) => {
          errMsg && /ok$/.test(errMsg)
            ? subscriber.next({
                localId,
                serverId,
              })
            : subscriber.error(errMsg);
          subscriber.complete();
        },
      });
    });
  }

  /**
   * 打开一个位置
   * @param location 位置信息
   * @returns
   * @example
   * 		// 服务端可用解析方式获取地址对应的坐标信息
   * 		// https://lbs.qq.com/service/webService/webServiceGuide/webServiceGeocoder
   *  	sdkService.openLocation(
   *			{
   *					latitude: 39.982915, // 纬度，浮点数，范围为90 ~ -90
   *					longitude: 116.307015, // 经度，浮点数，范围为180 ~ -180。
   *					name: "海淀西大街74号", // 位置名
   *					address: "海淀西大街74号", // 地址详情说明
   *					scale: 9, // 地图缩放级别,整形值,范围从1~28。默认为16
   *			}
   * 		).subscribe({
   * 	 		next:() =>{ console.log('操作成功') }
   * 		})
   */
  public openLocation(location: LocationInfo) {
    const _openLocation = new Observable<void>((subscriber) => {
      wx.openLocation({
        ...location,
        success: (res) => {
          if (this.resOk(res)) {
            subscriber.next();
            subscriber.complete();
          } else {
            subscriber.error(res.errMsg);
          }
        },
      });
    });

    return from(this.onReady()).pipe(
      filter((v) => !!v),
      switchMap(() => _openLocation)
    );
  }

  /**
   * 获取位置
   * @param location 位置信息
   * @example
   *  	sdkService.getLocation()
   * 		.subscribe({
   * 	 		next:(data:Location) =>{
   *				// 服务端可用反解析方式获取省市区信息
   *				// https://lbs.qq.com/service/webService/webServiceGuide/webServiceGcoder
   * 			}
   * 		})
   * @returns Location
   */
  public getLocation() {
    const _getLocation = new Observable<Location>((subscriber) => {
      wx.getLocation({
        type: "gcj02",
        success: (res) => {
          if (this.resOk(res)) {
            subscriber.next({
              longitude: res.longitude,
              latitude: res.latitude,
            });
            subscriber.complete();
          } else {
            subscriber.error(res.errMsg);
          }
        },
      });
    });

    return from(this.onReady()).pipe(
      filter((v) => !!v),
      switchMap(() => _getLocation)
    );
  }

  //#region 录音

  // 录音对象，在整个录音过程存在，手动停止后结束
  private recorder: Subscriber<string> | null = null;
  /**
   * 开始持续录音, 每一分钟会next一个值，需要自己存储,直到超过设定时间
   * @param durtion 持续时间，默认120分钟
   * @returns
   * @example
   * const recordIds = [];
   * const service = new WxSDKService();
   * service.startRecordes(30).subscribe({
   *	next: (id) => {
   *		recordIds.push(id);
   *		// upload this record
   *	},
   *	complete: () => {
   *		// upload
   *	},
   * });
   */
  public startRecordes(durtion = 120) {
    let count = 0;

    const recording = () => {
      wx.startRecord();
      count += 1;
    };

    return new Observable<string>((subscriber) => {
      this.onReady()
        .then(() => {
          // 全局存放，录音控制器
          this.recorder = subscriber;

          // 开始录音
          recording();
          wx.onVoiceRecordEnd({
            complete: (res) => {
              if (this.resOk(res) && this.recorder) {
                this.recorder.next(res.localId);
                // 如果录音持续时间小于设定时间，继续录音
                if (count < durtion) {
                  wx.startRecord();
                } else {
                  // 超过设定最大时间，结束
                  this.recorder.complete();
                  this.recorder = null;
                }
              } else {
                subscriber.error(res.errMsg);
                if (this.recorder) {
                  this.recorder.complete();
                  this.recorder = null;
                }
              }
            },
          });
        })
        .catch(() => this.onCatch(subscriber));
    });
  }

  /**
   * 录音停止
   * @returns Observable<void>
   * @example
   * const service = new WxSDKService();
   * service.stopRecord().subscribe({
   * 		next: () => {
   * 			// submit form data
   * 		},
   * 		error: (msg) => {
   * 			// notify error msg
   * 		},
   * });
   */
  public stopRecord() {
    const stop$ = new Observable<void>((subscriber) => {
      wx.stopRecord({
        success: (res) => {
          if (!this.recorder) {
            subscriber.error("录音控制器错误");
            return;
          }
          if (this.resOk(res)) {
            // 录音数据发送给start 时间的消息源
            this.recorder.next(res.localId);
            // 告诉本次操作正常结束
            subscriber.next();
          } else {
            subscriber.error(res.errMsg);
          }
          // 不管是否正常结束，录音对象都要置空
          this.recorder.complete();
          this.recorder = null;
        },
      });
    });

    return iif(
      () => !!this.recorder,
      from(this.onReady()),
      throwError(() => new Error("还未开始录音"))
    ).pipe(
      filter((v) => !!v), // 总之必须ready之后才可以执行wx的api
      switchMap(() => stop$)
    );
  }

  /**
   * 上传录音文件
   * @param localId 录音文件ID，通过startRecordes 订阅获取
   * @returns Observable
   * @example
   * const service = new WxSDKService();
   * // id通过startRecordes的订阅获取
   *	const id = "0001";
   *	const recordList = [
   *		{
   *			localId: "0001",
   *			serverId: "",
   *			uploaded: false,
   *		},
   *	];
   *
   *	service.uploadRecord(id).subscribe({
   *		next: ({ localId, serverId }) => {
   *			const item = recordList.find((x) => x.localId === localId);
   *			if (!item) return;
   *			item.serverId = serverId;
   *			item.uploaded = true;
   *			// need computed item uploaded status to render successful status
   *		},
   *		error: (msg) => {
   *			// notify error msg
   *		},
   *	});
   */
  public uploadRecord(localId: string) {
    return new Observable<UploadInfo>((subscriber) => {
      wx.uploadVoice({
        localId, // 需要上传的音频的本地ID，由stopRecord接口获得
        success: function (res) {
          if (this.resOk(res)) {
            subscriber.next({
              localId,
              serverId: res.serverId,
            });
          } else {
            subscriber.error(res.errMsg);
          }
        },
      });
    });
  }

  //#endregion

  //#region demo
  private demoFun() {
    const service = new WxSDKService();
    // id通过startRecordes的订阅获取
    const id = "0001";
    const recordList = [
      {
        localId: "0001",
        serverId: "",
        uploaded: false,
      },
    ];

    service.uploadRecord(id).subscribe({
      next: ({ localId, serverId }) => {
        const item = recordList.find((x) => x.localId === localId);
        if (!item) return;
        item.serverId = serverId;
        item.uploaded = true;
        // need computed item uploaded status to render successful status
      },
      error: (msg) => {
        // notify error msg
      },
    });
  }
  //#endregion
}

/**
 * 位置数据
 */
export interface Location {
  /**
   * 纬度，浮点数，范围为90 ~ -90
   */
  latitude: number;
  /**
   * 经度，浮点数，范围为180 ~ -180。
   */
  longitude: number;
}

/**
 * 位置信息
 */
export interface LocationInfo extends Location {
  /**
   * 位置名
   */
  name?: string;
  /**
   * 地址详情说明
   */
  address?: string;
  /**
   * 地图缩放级别,整形值,范围从1~28。默认为16
   */
  scale?: number;
}

/**
 * 图片信息
 */
export interface ImageInfo {
  /**
   * 图片ID，删除时区分
   */
  name: string;

  /**
   * 图片上传状态
   */
  status: UploadStatus;
  /**
   * uploadItem 的content属性，用来先显示图像
   */
  content: string;
  /**
   * 提示文字
   */
  message: string;

  /**
   * 服务器ID
   */
  serverId: string;
}

/**
 * 图片上传状态
 */
export type UploadStatus = "uploading" | "failed" | "done";

export interface ImageData {
  /**
   * 文件ID
   */
  localId: string;
  /**
   * base64 数据
   */
  data: string;
}

export interface UploadInfo {
  localId: string;

  /**
   * 在微信服务器的mediaId
   */
  serverId: string;
}
