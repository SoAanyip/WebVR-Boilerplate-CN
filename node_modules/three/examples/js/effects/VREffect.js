/**
 * @author dmarcos / https://github.com/dmarcos
 * @author mrdoob / http://mrdoob.com
 *
 * WebVR Spec: http://mozvr.github.io/webvr-spec/webvr.html
 *
 * Firefox: http://mozvr.com/downloads/
 * Chromium: https://drive.google.com/folderview?id=0BzudLt22BqGRbW9WTHMtOWMzNjQ&usp=sharing#list
 *
 */

THREE.VREffect = function ( renderer, onError ) {

	var vrHMD;
	var isDeprecatedAPI = false;
	var eyeTranslationL = new THREE.Vector3();
	var eyeTranslationR = new THREE.Vector3();
	var renderRectL, renderRectR;
	var eyeFOVL, eyeFOVR;

	function gotVRDevices( devices ) {

		for ( var i = 0; i < devices.length; i ++ ) {

			if ( 'VRDisplay' in window && devices[ i ] instanceof VRDisplay ) {

				vrHMD = devices[ i ];
				isDeprecatedAPI = false;
				break; // We keep the first we encounter

			} else if ( 'HMDVRDevice' in window && devices[ i ] instanceof HMDVRDevice ) {

				vrHMD = devices[ i ];
				isDeprecatedAPI = true;
				break; // We keep the first we encounter

			}
      
		}

		if ( vrHMD === undefined ) {

			if ( onError ) onError( 'HMD not available' );

		}

	}

	if ( navigator.getVRDisplays ) {

		navigator.getVRDisplays().then( gotVRDevices );

	} else if ( navigator.getVRDevices ) {

		// Deprecated API.
		navigator.getVRDevices().then( gotVRDevices );

	}


	this.scale = 1;

	var isPresenting = false;

	var rendererSize = renderer.getSize();
	var rendererPixelRatio = renderer.getPixelRatio();


	//初始化或者resize的时候进行。
	this.setSize = function ( width, height ) {
		rendererSize = { width: width, height: height };

		//是否VR模式中
		if ( isPresenting ) {
			var eyeParamsL = vrHMD.getEyeParameters( 'left' );
			//设备像素比
			//若设备像素比不为1时会出现显示问题。
			//https://github.com/mrdoob/three.js/pull/6248
			renderer.setPixelRatio( 1 );

			if ( isDeprecatedAPI ) {
				renderer.setSize( eyeParamsL.renderRect.width * 2, eyeParamsL.renderRect.height, false );

			} else {
				renderer.setSize( eyeParamsL.renderWidth * 2, eyeParamsL.renderHeight, false );
			}

		} else {
			renderer.setPixelRatio( rendererPixelRatio );
			renderer.setSize( width, height );
		}
	};

	// fullscreen

	var canvas = renderer.domElement;
	var requestFullscreen;
	var exitFullscreen;
	var fullscreenElement;

	//显示设备进入全屏显示模式
	function onFullscreenChange () {
		var wasPresenting = isPresenting;
		isPresenting = vrHMD !== undefined && ( vrHMD.isPresenting || ( isDeprecatedAPI && document[ fullscreenElement ] instanceof window.HTMLElement ) );
		if ( wasPresenting === isPresenting ) {
			return;
		}

		//如果此次事件是进入VR模式
		if ( isPresenting ) {
			//设备像素比
			//若设备像素比不为1时会出现显示问题。
			//https://github.com/mrdoob/three.js/pull/6248
			rendererPixelRatio = renderer.getPixelRatio();
			rendererSize = renderer.getSize();

			//getEyeParameters包含了渲染某个眼睛所视的屏幕的信息，例如offset,FOV等
			var eyeParamsL = vrHMD.getEyeParameters( 'left' );
			var eyeWidth, eyeHeight;

			if ( isDeprecatedAPI ) {
				eyeWidth = eyeParamsL.renderRect.width;
				eyeHeight = eyeParamsL.renderRect.height;
			} else {
				eyeWidth = eyeParamsL.renderWidth;
				eyeHeight = eyeParamsL.renderHeight;
			}
			renderer.setPixelRatio( 1 );
			renderer.setSize( eyeWidth * 2, eyeHeight, false );

		} else {
			renderer.setPixelRatio( rendererPixelRatio );
			renderer.setSize( rendererSize.width, rendererSize.height );
		}
	}

	//全屏显示事件
	if ( canvas.requestFullscreen ) {
		requestFullscreen = 'requestFullscreen';
		fullscreenElement = 'fullscreenElement';
		exitFullscreen = 'exitFullscreen';
		document.addEventListener( 'fullscreenchange', onFullscreenChange, false );

	} else if ( canvas.mozRequestFullScreen ) {
		requestFullscreen = 'mozRequestFullScreen';
		fullscreenElement = 'mozFullScreenElement';
		exitFullscreen = 'mozCancelFullScreen';
		document.addEventListener( 'mozfullscreenchange', onFullscreenChange, false );

	} else {
		requestFullscreen = 'webkitRequestFullscreen';
		fullscreenElement = 'webkitFullscreenElement';
		exitFullscreen = 'webkitExitFullscreen';
		document.addEventListener( 'webkitfullscreenchange', onFullscreenChange, false );
	}

	window.addEventListener( 'vrdisplaypresentchange', onFullscreenChange, false );


	this.setFullScreen = function ( boolean ) {
		return new Promise( function ( resolve, reject ) {

			if ( vrHMD === undefined ) {
				reject( new Error( 'No VR hardware found.' ) );
				return;
			}
			if ( isPresenting === boolean ) {
				resolve();
				return;
			}
			if ( ! isDeprecatedAPI ) {
				if ( boolean ) {
					resolve( vrHMD.requestPresent( [ { source: canvas } ] ) );
				} else {
					resolve( vrHMD.exitPresent() );
				}
			} else {
				if ( canvas[ requestFullscreen ] ) {
					canvas[ boolean ? requestFullscreen : exitFullscreen ]( { vrDisplay: vrHMD } );
					resolve();

				} else {
					console.error( 'No compatible requestFullscreen method found.' );
					reject( new Error( 'No compatible requestFullscreen method found.' ) );
				}
			}
		} );
	};

	this.requestPresent = function () {

		return this.setFullScreen( true );

	};

	this.exitPresent = function () {

		return this.setFullScreen( false );

	};

	// render

	var cameraL = new THREE.PerspectiveCamera();
	//左camera显示layer 1层（即当某个元素只出现在layer 1时，只有cameraL可见。）
	cameraL.layers.enable( 1 );

	var cameraR = new THREE.PerspectiveCamera();
	cameraR.layers.enable( 2 );

	this.render = function ( scene, camera ) {

		if ( vrHMD && isPresenting ) {

			var autoUpdate = scene.autoUpdate;

			if ( autoUpdate ) {
				scene.updateMatrixWorld();
				scene.autoUpdate = false;
			}

			//getEyeParameters包含了渲染某个眼睛所视的屏幕的信息，例如offset,FOV等
			var eyeParamsL = vrHMD.getEyeParameters( 'left' );
			var eyeParamsR = vrHMD.getEyeParameters( 'right' );

			if ( ! isDeprecatedAPI ) {
				// represents the offset from the center point between the user's eyes to the center of the eye, measured in meters.
				//瞳距的偏移
				eyeTranslationL.fromArray( eyeParamsL.offset );
				eyeTranslationR.fromArray( eyeParamsR.offset );
				//represents a field of view defined by 4 different degree values describing the view from a center point.
				//获得左右眼的FOV
				eyeFOVL = eyeParamsL.fieldOfView;
				eyeFOVR = eyeParamsR.fieldOfView;

			} else {
				eyeTranslationL.copy( eyeParamsL.eyeTranslation );
				eyeTranslationR.copy( eyeParamsR.eyeTranslation );
				eyeFOVL = eyeParamsL.recommendedFieldOfView;
				eyeFOVR = eyeParamsR.recommendedFieldOfView;
			}

			if ( Array.isArray( scene ) ) {
				console.warn( 'THREE.VREffect.render() no longer supports arrays. Use object.layers instead.' );
				scene = scene[ 0 ];
			}

			// When rendering we don't care what the recommended size is, only what the actual size
			// of the backbuffer is.
			//双眼可视区域的分割
			var size = renderer.getSize();
			renderRectL = { x: 0, y: 0, width: size.width / 2, height: size.height };
			renderRectR = { x: size.width / 2, y: 0, width: size.width / 2, height: size.height };

			//only the pixels within the defined scissor area will be affected by further renderer actions.	
			//开启渲染区域裁剪。只有规定区域内的像素会被渲染。
			renderer.setScissorTest( true );
			renderer.clear();

			if ( camera.parent === null ) camera.updateMatrixWorld();


			cameraL.projectionMatrix = fovToProjection( eyeFOVL, true, camera.near, camera.far );
			cameraR.projectionMatrix = fovToProjection( eyeFOVR, true, camera.near, camera.far );

			//使主camera的位移、旋转、缩放变换分解，作用到左camra 右camera上。
			camera.matrixWorld.decompose( cameraL.position, cameraL.quaternion, cameraL.scale );
			camera.matrixWorld.decompose( cameraR.position, cameraR.quaternion, cameraR.scale );

			var scale = this.scale;
			//左右眼camera根据瞳距进行位移。
			cameraL.translateOnAxis( eyeTranslationL, scale );
			cameraR.translateOnAxis( eyeTranslationR, scale );


			// 渲染左眼视觉
			renderer.setViewport( renderRectL.x, renderRectL.y, renderRectL.width, renderRectL.height );
			renderer.setScissor( renderRectL.x, renderRectL.y, renderRectL.width, renderRectL.height );
			renderer.render( scene, cameraL );

			// 渲染右眼视觉
			renderer.setViewport( renderRectR.x, renderRectR.y, renderRectR.width, renderRectR.height );
			renderer.setScissor( renderRectR.x, renderRectR.y, renderRectR.width, renderRectR.height );
			renderer.render( scene, cameraR );

			//关掉渲染区域裁剪
			renderer.setScissorTest( false );

			if ( autoUpdate ) {
				scene.autoUpdate = true;
			}

			if ( ! isDeprecatedAPI ) {
				vrHMD.submitFrame();
			}

			return;
		}

		// Regular render mode if not HMD
		renderer.render( scene, camera );
	};


	//计算线性插值信息
	function fovToNDCScaleOffset( fov ) {

		var pxscale = 2.0 / ( fov.leftTan + fov.rightTan );
		var pxoffset = ( fov.leftTan - fov.rightTan ) * pxscale * 0.5;
		var pyscale = 2.0 / ( fov.upTan + fov.downTan );
		var pyoffset = ( fov.upTan - fov.downTan ) * pyscale * 0.5;
		return { scale: [ pxscale, pyscale ], offset: [ pxoffset, pyoffset ] };
	}

	//根据从设备获得的FOV以及相机设定的near、far来生成透视投影矩阵
	function fovPortToProjection( fov, rightHanded, zNear, zFar ) {

		//使用右手坐标
		rightHanded = rightHanded === undefined ? true : rightHanded;
		zNear = zNear === undefined ? 0.01 : zNear;
		zFar = zFar === undefined ? 10000.0 : zFar;

		var handednessScale = rightHanded ? - 1.0 : 1.0;

		// start with an identity matrix
		//新建一个单位矩阵
		var mobj = new THREE.Matrix4();
		var m = mobj.elements;

		// and with scale/offset info for normalized device coords
		//计算线性插值信息
		var scaleAndOffset = fovToNDCScaleOffset( fov );

		//建立透视投影矩阵

		// X result, map clip edges to [-w,+w]
		m[ 0 * 4 + 0 ] = scaleAndOffset.scale[ 0 ];
		m[ 0 * 4 + 1 ] = 0.0;
		m[ 0 * 4 + 2 ] = scaleAndOffset.offset[ 0 ] * handednessScale;
		m[ 0 * 4 + 3 ] = 0.0;

		// Y result, map clip edges to [-w,+w]
		// Y offset is negated because this proj matrix transforms from world coords with Y=up,
		// but the NDC scaling has Y=down (thanks D3D?)
		//NDC（归一化设备坐标系）是左手坐标系
		m[ 1 * 4 + 0 ] = 0.0;
		m[ 1 * 4 + 1 ] = scaleAndOffset.scale[ 1 ];
		m[ 1 * 4 + 2 ] = - scaleAndOffset.offset[ 1 ] * handednessScale;
		m[ 1 * 4 + 3 ] = 0.0;

		// Z result (up to the app)
		m[ 2 * 4 + 0 ] = 0.0;
		m[ 2 * 4 + 1 ] = 0.0;
		m[ 2 * 4 + 2 ] = zFar / ( zNear - zFar ) * - handednessScale;
		m[ 2 * 4 + 3 ] = ( zFar * zNear ) / ( zNear - zFar );

		// W result (= Z in)
		m[ 3 * 4 + 0 ] = 0.0;
		m[ 3 * 4 + 1 ] = 0.0;
		m[ 3 * 4 + 2 ] = handednessScale;
		m[ 3 * 4 + 3 ] = 0.0;

		//转置矩阵，因为mobj.elements是column-major的
		mobj.transpose();

		return mobj;
	}


	//角度弧度的转换，然后进行后续的计算
	function fovToProjection( fov, rightHanded, zNear, zFar ) {
		//角度转换为弧度  如30度转为1/6 PI
		var DEG2RAD = Math.PI / 180.0;

		var fovPort = {
			upTan: Math.tan( fov.upDegrees * DEG2RAD ),
			downTan: Math.tan( fov.downDegrees * DEG2RAD ),
			leftTan: Math.tan( fov.leftDegrees * DEG2RAD ),
			rightTan: Math.tan( fov.rightDegrees * DEG2RAD )
		};

		return fovPortToProjection( fovPort, rightHanded, zNear, zFar );
	}

};
