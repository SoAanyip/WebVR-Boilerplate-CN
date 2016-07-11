/**
 * @author dmarcos / https://github.com/dmarcos
 * @author mrdoob / http://mrdoob.com
 */

THREE.VRControls = function ( object, onError ) {

	var scope = this;

	var vrInput;

	var standingMatrix = new THREE.Matrix4();

	/*获取VR设备（作为信息输入源。如有多个则只取第一个）*/
	function gotVRDevices( devices ) {
		for ( var i = 0; i < devices.length; i ++ ) {
			if ( ( 'VRDisplay' in window && devices[ i ] instanceof VRDisplay ) ||
				 ( 'PositionSensorVRDevice' in window && devices[ i ] instanceof PositionSensorVRDevice ) ) {
				vrInput = devices[ i ];
				break;  // We keep the first we encounter
			}
		}

		if ( !vrInput ) {
			if ( onError ) onError( 'VR input not available.' );
		}
	}
	/*调用WebVR API获取VR设备*/
	if ( navigator.getVRDisplays ) {
		navigator.getVRDisplays().then( gotVRDevices );
	} else if ( navigator.getVRDevices ) {
		// Deprecated API.
		navigator.getVRDevices().then( gotVRDevices );
	}

	// the Rift SDK returns the position in meters
	// this scale factor allows the user to define how meters
	// are converted to scene units.
	//Rift SDK返回的位置信息是以米作为单位的。这里可以定义以几倍的缩放比例转换为three.js中的长度。
	this.scale = 1;

	// If true will use "standing space" coordinate system where y=0 is the
	// floor and x=0, z=0 is the center of the room.
	//表示使用者是否站立姿态。当为false时camra会在y=0的位置，而为true时会结合下面的模拟身高来决定camera的y值。
	//在无法获取用户姿势信息的设备上，需要在调用时直接指定是站姿还是坐姿。
	this.standing = false;

	// Distance from the users eyes to the floor in meters. Used when
	// standing=true but the VRDisplay doesn't provide stageParameters.
	//当为站立姿态时，用户的眼睛（camera）的高度（跟如有硬件时返回的单位一致，为米）。这里会受scale的影响。如scale为2时，实际camera的高度就是3.2。
	this.userHeight = 1.6;

	//将在requestAnimationFrame中应用更新
	this.update = function () {
		if ( vrInput ) {
			if ( vrInput.getPose ) {
				//方法返回传感器在某一时刻的信息(object)。例如包括时间戳、位置(x,y,z)、线速度、线加速度、角速度、角加速度、方向信息。
				var pose = vrInput.getPose();
				//orientation 方向
				if ( pose.orientation !== null ) {
					//quaternion  四元数
					//把设备的方向复制给camera
					object.quaternion.fromArray( pose.orientation );
				}
				//位置信息
				if ( pose.position !== null ) {
					//同样把设备的位置复制给camera
					object.position.fromArray( pose.position );
				} else {
					object.position.set( 0, 0, 0 );
				}

			} else {
				// Deprecated API.
				var state = vrInput.getState();
				if ( state.orientation !== null ) {
					object.quaternion.copy( state.orientation );
				}
				if ( state.position !== null ) {
					object.position.copy( state.position );
				} else {
					object.position.set( 0, 0, 0 );
				}
			}

			//TODO 此块会一直执行
			if ( this.standing ) {
				//如果硬件返回场景信息，则应用硬件返回的数据来进行站姿转换
				if ( vrInput.stageParameters ) {
					object.updateMatrix();
					//sittingToStandingTransform返回一个Matrix4的Float32Array,表示从坐姿到站姿的变换。
					standingMatrix.fromArray(vrInput.stageParameters.sittingToStandingTransform);
					//应用变换到camera。
					object.applyMatrix( standingMatrix );
				} else {
					//如果vrInput不提供y高度信息的话使用userHeight作为高度
					object.position.setY( object.position.y + this.userHeight );
				}

			}
			//使用上面定义的this.scale来缩放camera的位置。
			object.position.multiplyScalar( scope.scale );
		}
	};

	this.resetPose = function () {
		if ( vrInput ) {
			if ( vrInput.resetPose !== undefined ) {
				vrInput.resetPose();
			} else if ( vrInput.resetSensor !== undefined ) {
				// Deprecated API.
				vrInput.resetSensor();
			} else if ( vrInput.zeroSensor !== undefined ) {
				// Really deprecated API.
				vrInput.zeroSensor();
			}
		}
	};

	this.resetSensor = function () {
		console.warn( 'THREE.VRControls: .resetSensor() is now .resetPose().' );
		this.resetPose();
	};

	this.zeroSensor = function () {
		console.warn( 'THREE.VRControls: .zeroSensor() is now .resetPose().' );
		this.resetPose();
	};

	this.dispose = function () {
		vrInput = null;
	};

};
