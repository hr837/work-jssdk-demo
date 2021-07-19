import {
  Observable,
  Subscriber,
  from,
  iif,
  throwError,
  of,
  race,
  interval,
} from "rxjs";
import {
  concatMap,
  filter,
  switchMap,
  concatWith,
  timeout,
  take,
  repeat,
  finalize,
  tap,
  raceWith,
  delay,
  switchMapTo,
  mergeWith,
  concatMapTo,
} from "rxjs/operators";

declare var wx: any;

/**
 * 要使用的接口列表
 */
const jsApiList = [
  "getLocalImgData",
  "chooseImage",
  "uploadImage",
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
 * 成功正则表达式
 */
const okRegx = /ok$/;

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
      appId: "ww1dc4285449f9bd3e", // 必填，企业微信的corpID
      timestamp: "1626667851506", // 必填，生成签名的时间戳
      nonceStr: "xmgjyh", // 必填，生成签名的随机串
      signature: "6c39230cb61dc1bc31020f4b226cf41199842b68", // 必填，签名，见 附录-JS-SDK使用权限签名算法
      jsApiList, // 必填，需要使用的JS接口列表，凡是要调用的接口都需要传进来
    });

    return new Promise<boolean>((resolve, reject) => {
      // ready jssdk可以使用
      wx.ready(() => resolve(true));
      wx.error((res: any) => {
        reject(false);
        console.error(res.errMsg, "onError");
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

  private onCatch(subscriber: Subscriber<any>) {
    return subscriber.error(this.SDK_ERROR);
  }

  /**
   * 用户可能会做刷新操作，这时候应该处理有可能在应用主体正在执行的API
   */
  public initialApi() {
    this.onReady().then((v) => {
      if (!v) return;
      // 应该停止录音
      wx.stopRecord();

      // 应该停止播放录音
      wx.stopVoice();
    });
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
          errMsg && okRegx.test(errMsg)
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
            errMsg && okRegx.test(errMsg)
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
          errMsg && okRegx.test(errMsg)
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
        success: ({ errMsg }) => {
          if (okRegx.test(errMsg)) {
            subscriber.complete();
          } else {
            subscriber.error(errMsg);
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
        success: ({ errMsg, longitude, latitude }) => {
          if (okRegx.test(errMsg)) {
            subscriber.next({
              longitude,
              latitude,
            });
            subscriber.complete();
          } else {
            subscriber.error(errMsg);
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
  private recorder = false;
  /**
   * 开始持续录音, 默认每59秒一个录音文件，录音10次。
   * @param durtion 持续时间，单位：秒
   * @param times 录音多少次后停止
   * @returns
   * @example
   * const recordIds = [];
   * let recordFlag = false;
   * const service = new WxSDKService();
   * service.startRecordes().subscribe({
   *	next: (value) => {
   *    if(typeof value === 'boolean'){
   *      recordFlag = true
   *    }else{
   *      recordIds.push(id);
   *  		// upload this record
   *    }
   *	},
   *	complete: () => {
   *		// 录音最大限制次数已到
   *    recordFlag = false
   *	},
   * });
   */
  public startRecord(durtion = 10, times = 10) {
    if (durtion > 59) {
      throw new Error("每一段录音时间不能超过59s,否则IOS会弹窗提醒");
    }
    if (times > 10) {
      console.log("时间太长应防止黑屏或被系统杀掉进程");
    }

    // 默认50ms成功
    const $staredDefault = of(true).pipe(
      delay(50),
      tap(() => console.log("录音开始无回调，自动切换为true"))
    );
    // 开始录音
    const $start = new Observable<boolean>((subscribe) => {
      wx.startRecord({
        complete: ({ errMsg }) => {
          console.log("本次录音开始...");
          if (okRegx.test(errMsg)) {
            subscribe.next(true);
          } else {
            subscribe.error(errMsg);
            subscribe.complete();
          }
        },
      }); // 200ms后无响应，则切换到true
    }).pipe(raceWith($staredDefault));

    const $stop = new Observable<string>((subscribe) => {
      wx.stopRecord({
        complete: ({ errMsg, localId }) => {
          console.log("本次录音结束...");
          if (okRegx.test(errMsg)) {
            subscribe.next(localId);
          } else {
            subscribe.error(errMsg);
            subscribe.complete();
          }
        },
      });
    });

    // 直到停止时间到，发送stop得到数据
    const $utillStop = interval(durtion * 1000).pipe(
      take(1),
      switchMapTo($stop)
    );

    return iif(
      () => !!this.recorder,
      throwError(() => new Error("正在录音中")),
      from(this.onReady())
    ).pipe(
      filter((v) => !!v),
      switchMapTo($start), // 切换到开始
      take(1),
      concatWith($utillStop),
      take(2),
      repeat(times),
      filter((v, index) => typeof v === "string" || index === 0)
    );
  }

  /**
   * 录音停止
   * @returns Observable<void>
   * @example
   *   const service = new WxSDKService();
   *   // id通过startRecordes的订阅获取
   *   // ...
   *   let startRecordSubscribtion = service.startRecord().subscribe();
   *   const list: string[] = [];
   *   let startRecordFlag = true;
   *   // ...
   *
   *   startRecordSubscribtion.unsubscribe();
   *   service.stopRecord().subscribe({
   *     next: (localId) => {
   *       list.push(localId);
   *     },
   *     error: (err) => {
   *       console.log(err);
   *     },
   *     complete: () => {
   *       startRecordFlag = false;
   *     },
   *   });
   */
  public stopRecord() {
    const stop$ = new Observable<string>((subscriber) => {
      wx.stopRecord({
        success: ({ errMsg, localId }) => {
          if (okRegx.test(errMsg)) {
            // 录音数据发送给start 时间的消息源
            subscriber.next(localId);
            // 告诉本次操作正常结束
          } else {
            subscriber.error(errMsg);
          }
          subscriber.complete();
        },
      });
    });

    return from(this.onReady()).pipe(
      filter((v) => !!v), // 总之必须ready之后才可以执行wx的api
      switchMapTo(stop$)
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
    const upload$ = new Observable<UploadInfo>((subscriber) => {
      wx.uploadVoice({
        localId, // 需要上传的音频的本地ID，由stopRecord接口获得
        isShowProgressTips: 0, // 不显示上传进度，没用
        success: ({ errMsg, serverId }) => {
          if (okRegx.test(errMsg)) {
            subscriber.next({
              localId,
              serverId: serverId,
            });
          } else {
            subscriber.error(errMsg);
          }
        },
      });
    });

    return from(this.onReady()).pipe(
      filter((v) => !!v),
      switchMap(() => upload$)
    );
  }

  /**
   * 播放录音
   * 如果需要连续播放，可以在complete回调里面调用一次播放
   * @param recordId
   * @returns
   */
  public playRecord(recordId: string) {
    const play$ = new Observable<string>((subscriber) => {
      console.log("%c 准备播放", "color:green;");

      // 播放操作
      wx.playVoice({
        localId: recordId, // 需要播放的音频的本地ID，由stopRecord接口获得
        fail: ({ errMsg }) => {
          console.log("%c 播放错误", "color:red;");
          subscriber.error(errMsg);
        },
      });

      /**
       * BUG 处理
       * 因为在安卓手机 打开企业微信应用 wx.playVoice 第一次不触发success回调。
       * 所以这里默认播放成功，只有失败的时候处理errMsg
       * Duang 2021-07-07
       */
      subscriber.next(recordId);

      // 处理自动结束
      wx.onVoicePlayEnd({
        success: ({ errMsg, localId }) => {
          console.log("%c 播放结束", "color:green;");
          if (okRegx.test(errMsg)) {
            // 告诉外部，播放完毕了，可以下一次了
            localId === recordId
              ? subscriber.complete()
              : subscriber.error("stoped:" + localId);
          } else {
            subscriber.error(errMsg);
          }
        },
      });
    });

    return from(this.onReady()).pipe(
      filter((v) => !!v),
      switchMap(() => play$)
    );
  }

  /**
   * 停止播放
   * 停止播放成功，会返回停止的录音ID
   * @param recoredId
   * @returns
   */
  public playStop(recoredId: string) {
    const stop$ = new Observable<void>((subscriber) => {
      wx.stopVoice({
        localId: recoredId, // 需要停止的音频的本地ID，由stopRecord接口获得
        success: ({ errMsg, localId }) => {
          if (okRegx.test(errMsg)) {
            subscriber.next(localId);
          } else {
            subscriber.error(errMsg);
          }
          subscriber.complete();
        },
      });
    });

    return from(this.onReady()).pipe(
      filter((v) => !!v),
      switchMap(() => stop$)
    );
  }

  //#endregion

  //#region demo
  private demoFun() {
    const service = new WxSDKService();
    // id通过startRecordes的订阅获取
    // ...
    let startRecordSubscribtion = service.startRecord().subscribe();
    const list: string[] = [];
    let startRecordFlag = true;
    // ...

    startRecordSubscribtion.unsubscribe();
    service.stopRecord().subscribe({
      next: (localId) => {
        list.push(localId);
      },
      error: (err) => {
        console.log(err);
      },
      complete: () => {
        startRecordFlag = false;
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

export interface RecordInfo extends UploadInfo {
  status: UploadStatus;
}
