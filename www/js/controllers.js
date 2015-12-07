angular.module('starter.controllers', [])

.controller('loginCtrl', function($scope, $state, $localstorage) {
    /* Login Controller: 서버 접속할 때 사용할 아이디를 설정함. */
    console.log('Start: Login Controller');

    $scope.startParticipant = function() {
        if($scope.name === "")
            alert('이름을 입력해주세요.');
        else {
            $localstorage.setID($scope.name);
            $state.go('train');
        }
    };
})

.controller('trainCtrl', function($scope, $interval, $cordovaDeviceMotion, $localstorage, $analyzer, $cordovaMedia, $state) {
    /* Train Controller: 게임에 사용될 제스처들을 트레이닝하는 화면 */
    console.log('Start: Train Controller');

    var subgestureList = ['Left','Right','Forward','Backward','Up','Down'];
    var gestureList = {ship: ['Left', 'Right'], hug: ['Forward','Backward'], fist: ['Up', 'Down']};

    $scope.trainSubgesture = function(subgesture_name) {
        // train a gesture
        console.log('Function: trainGesture of ' + subgesture_name);

        // check if gesture name is valid
        if(subgestureList.indexOf(subgesture_name)==-1) {
            console.log('Err: ' + subgesture_name + ' is invalid gesture');
        } else {
            $scope.startCollection(subgesture_name);
        }
    };

    var stop = undefined;
    $scope.startCollection = function(subgesture) {
        // collect data for a subgesture
        console.log('Function: startCollection of ' + subgesture);
        $scope.stopCollection();

        // Data set
        var recorded_data = [
            [], // For_X
            [], // For_Y
            [] // For_Z
        ];
        var magnitude_array = [];

        // Status Variables
        var isRecording = false;
        var isStable = false;

        // start collection...
        var gravity = [0, 0, 0];
        stop = $interval(function() {
          // get accelerometer data
          $cordovaDeviceMotion.getCurrentAcceleration().then(function(result) {

              // remove gravity
              var alpha = 0.8;

              gravity[0] = alpha * gravity[0] + (1 - alpha) * result.x;
              gravity[1] = alpha * gravity[1] + (1 - alpha) * result.y;
              gravity[2] = alpha * gravity[2] + (1 - alpha) * result.z;

              var x = result.x - gravity[0];
              var y = result.y - gravity[1];
              var z = result.z - gravity[2];
              var magnitude = Math.sqrt(x * x + y * y + z * z);

              // add magnitude value to magnitude array
              magnitude_array.push(magnitude);

              var avg = 10000;  // Quite Large AVG
              if(magnitude_array.length > 5) { // 5는 magnitude average 의 크기
                var sum = 0;
                for(var i = 0; i < magnitude_array.length; i++)
                    sum += magnitude_array[i];
                avg = sum / magnitude_array.length;
                magnitude_array.shift();
              }

              if(isRecording === false && isStable === false) { // before stable
                if(avg < 0.5) { // stable
                    isStable = true;
                    $scope.guide_message = "제스처를 시작해주세요";
                }
              } else if(isRecording === false && isStable === true) { // After stable
                if(avg > 1.5) { // moving
                    isRecording = true;
                    $scope.guide_message = "제스처 수집중";
                }
              } else if(isRecording === true && isStable === true) {  // During Recording
                if(avg < 1 && recorded_data[0].length > 10) {
                    $scope.stopCollection();
                    $scope.guide_message = "제스처 수집 종료";
                    var template = [];
                    for(var j = 0; j < recorded_data[0].length; j++) {
                            var feature = [];
                            var mag = Math.sqrt(recorded_data[0][j] * recorded_data[0][j] + recorded_data[1][j] * recorded_data[1][j] + recorded_data[2][j] * recorded_data[2][j]);
                            feature.push(recorded_data[0][j] / mag); // x
                            feature.push(recorded_data[1][j] / mag); // y
                            feature.push(recorded_data[2][j] / mag); // z
                            template.push(feature);
                    }
                    $localstorage.setTemplate(subgesture, {subgesture:template});
                } else {
                    recorded_data[0].push(x);
                    recorded_data[1].push(y);
                    recorded_data[2].push(z);
                }
              }
          }, function(err) {
            // An error occurred. Show a message to the user
          });
        }, 25);
    };

    $scope.startTest = function(gesture) {
        if ( angular.isDefined(stop) ) return;
        // start test
        console.log('Function: startTest of ' + gesture);

        // get sub gesture list
        var subgesture = gestureList[gesture];

        $scope.testing = true;
        $scope.left_button_activate = false;
        $scope.right_button_activate = false;

        // initialize raw mode
        $scope.collection_features = [];
        $scope.collection_feature_magnitudes = [];
        $scope.analysis_index = 0;

        $scope.current_state = "Non";

        // get templates from local storage
        var left_template = $localstorage.getTemplate(subgesture[0])["subgesture"];
        var right_template = $localstorage.getTemplate(subgesture[1])["subgesture"];
        console.log('A Length of a first template : ' + left_template.length);
        console.log('A Length of a second template : : ' + right_template.length);


        var frame_size = Math.min(left_template.length, right_template.length); // 이거 어떻게 정해야하는지 고민되는 구만

        $scope.left_distance = 0;
        $scope.right_distance = 0;

        var left_src = "/audio/Left.mp3";
        var left_media = $cordovaMedia.newMedia(left_src);
        left_media.setVolume(0.5);

        var right_src = "/audio/Right.mp3";
        var right_media = $cordovaMedia.newMedia(right_src);
        right_media.setVolume(0.5);

        // start collecting
        var gravity = [0, 0, 0];
        stop = $interval(function() {
          // get accelerometer data
          $cordovaDeviceMotion.getCurrentAcceleration().then(function(result) {

              $scope.analysis_index++;

              // calculate similarity
              if($scope.collection_features.length > frame_size) {
                 $scope.collection_features.shift();
                 $scope.collection_feature_magnitudes.shift();

                 // calculate average magnitude
                 var sum = 0;
                 for(var i = $scope.collection_feature_magnitudes.length - 5; i < $scope.collection_feature_magnitudes.length; i++)
                    sum += $scope.collection_feature_magnitudes[i];
                 $scope.avg_magnitude = sum / $scope.collection_feature_magnitudes.length;

                 if($scope.analysis_index % 2 == 0) {
                     // 현재 Left 인지 Right 인지로 구분해서 하면 되겠구나
                     if($scope.current_state !== 'Left') {
                        // Right or None
                        var left_distance = $analyzer.getSimilarity(left_template, $scope.collection_features);
                        if(left_distance < 15) {
                            console.log('Left Gesture');
                            $scope.current_state = 'Left';
                            $scope.guide_message = 'Left';
                            $scope.left_distance = left_distance;
                            // 소리 Play
                            //background_media.pause();
                            left_media.play();
                            //setTimeout(function(){ left_media.stop(); background_media.play(); }, 1000);
                        }
                     } else if($scope.current_state !== 'Right') {
                        var right_distance = $analyzer.getSimilarity(right_template, $scope.collection_features);
                        if(right_distance < 15) {
                            console.log('Right Gesture');
                            $scope.current_state = 'Right';
                            $scope.guide_message = 'Right';
                            $scope.right_distance = right_distance;
                            // 소리 Play
                            //background_media.pause();
                            right_media.play();
                            //setTimeout(function(){ right_media.stop(); background_media.play(); }, 1000);
                        }
                     }
                 }
              }

              // remove gravity
              var alpha = 0.8;
              gravity[0] = alpha * gravity[0] + (1 - alpha) * result.x;
              gravity[1] = alpha * gravity[1] + (1 - alpha) * result.y;
              gravity[2] = alpha * gravity[2] + (1 - alpha) * result.z;

              // normalize and make collection_features
              var frame_feature = [];
              var magnitude = Math.sqrt((result.x - gravity[0]) * (result.x - gravity[0]) + (result.y - gravity[1]) * (result.y - gravity[1]) + (result.z - gravity[2]) * (result.z - gravity[2]));
              frame_feature.push((result.x - gravity[0]) / magnitude);
              frame_feature.push((result.y - gravity[1]) / magnitude);
              frame_feature.push((result.z - gravity[2]) / magnitude);
              $scope.collection_features.push(frame_feature);
              $scope.collection_feature_magnitudes.push(magnitude);

          }, function(err) {
            // An error occurred. Show a message to the user

          });
        }, 25);
    };

    $scope.stopCollection = function() {

        if (angular.isDefined(stop)) {
          $interval.cancel(stop);
          stop = undefined;
          $scope.testing = false;
          $scope.left_button_activate = true;
          $scope.right_button_activate = true;
        }

    };

    $scope.imready = function() {
        console.log("I'm Ready");
        $state.go('login');
    };

});
//
//
//.controller('homeCtrl', function($scope, $cordovaDeviceMotion, $interval, $state, $analyzer, $communication, $ionicPopup) {
//
//  $scope.option = {animation: false, pointDot: false, datasetFill : false,
//                    scaleOverride : true, scaleSteps : 8, scaleStepWidth : 5, scaleStartValue : -20 };
//  $scope.option_analysis = {animation: false, pointDot: false, datasetFill : false};
//
//  $scope.raw_graph = true;
//  $scope.feature_graph = true;
//
//  // for feature data
//  $scope.change_mode = true;
//  $scope.feature_mode = "Avg";
//
//  $scope.series = ['X', 'Y', 'Z'];
//  $scope.data = [
//        [], // x
//        [], // y
//        []  // z
//  ];
//  $scope.timestamp = [];
//  $scope.labels = [];
//
//  // for recording
//  $scope.isCollecting = false;
//  $scope.recording_message = "";
//
//  var total_sample_size = 199;
//  var stop;
//  $scope.startCollection = function() {
//
//    if ( angular.isDefined(stop) ) return;
//
//    // initialize raw mode
//    // for raw data
//    $scope.series = ['X', 'Y', 'Z'];
//    $scope.data = [
//        [], // x
//        [], // y
//        []  // z
//    ];
//    $scope.timestamp = [];
//    $scope.labels = [];
//
//    // initialize analysis mode
//    $scope.change_mode = false;
//    $scope.data_analysis = [
//            [], // For_X
//            [], // For_Y
//            []  // For_Z
//    ];
//    $scope.labels_analysis = [];
//
//    if( $scope.feature_mode === "Avg") {
//      $scope.series_analysis = ['AVG_X', 'AVG_Y', 'AVG_Z'];
//    } else if($scope.feature_mode === "Std") {
//      $scope.series_analysis = ['Std_X', 'Std_Y', 'Std_Z'];
//    } else if($scope.feature_mode === "1-dev") {
//      $scope.series_analysis = ['1Dev_X', '1Dev_Y', '1Dev_Z'];
//    }
//
//    // start collecting
//    var gravity = [0, 0, 0];
//    stop = $interval(function() {
//      // get accelerometer data
//      $cordovaDeviceMotion.getCurrentAcceleration().then(function(result) {
//
//          // set raw data
//          if($scope.data[0].length > total_sample_size) {
//             $scope.data[0].shift();
//             $scope.data[1].shift();
//             $scope.data[2].shift();
//             $scope.timestamp.shift();
//             $scope.labels.shift();
//          }
//
//          // remove gravity
//          var alpha = 0.8;
//
//          gravity[0] = alpha * gravity[0] + (1 - alpha) * result.x;
//          gravity[1] = alpha * gravity[1] + (1 - alpha) * result.y;
//          gravity[2] = alpha * gravity[2] + (1 - alpha) * result.z;
//
//
//          $scope.data[0].push(result.x - gravity[0]);
//          $scope.data[1].push(result.y - gravity[1]);
//          $scope.data[2].push(result.z - gravity[2]);
//          $scope.labels.push('-');
//          $scope.timestamp.push(result.timestamp);
//
//          if($scope.data_analysis[0].length > total_sample_size) {
//             $scope.data_analysis[0].shift();
//             $scope.data_analysis[1].shift();
//             $scope.data_analysis[2].shift();
//             $scope.labels_analysis.shift();
//          }
//
//          // set feature data
//          var window_size = 10.0;
//          if($scope.data[0].length > window_size) {
//              // create frame
//              var frame_x = [];
//              var frame_y = [];
//              var frame_z = [];
//
//              for(var i = $scope.data[0].length - window_size; i < $scope.data[0].length; i++) {
//                    frame_x.push($scope.data[0][i]);
//                    frame_y.push($scope.data[1][i]);
//                    frame_z.push($scope.data[2][i]);
//              }
//
//              if($scope.feature_mode === 'Avg') {
//                  // 1. average
//                  $scope.data_analysis[0].push($analyzer.getAvg(frame_x));
//                  $scope.data_analysis[1].push($analyzer.getAvg(frame_y));
//                  $scope.data_analysis[2].push($analyzer.getAvg(frame_z));
//
//              } else if ($scope.feature_mode === 'Std') {
//                  // 2. std
//                  $scope.data_analysis[0].push($analyzer.getStd(frame_x));
//                  $scope.data_analysis[1].push($analyzer.getStd(frame_y));
//                  $scope.data_analysis[2].push($analyzer.getStd(frame_z));
//
//              } else if ($scope.feature_mode === '1-dev') {
//                  // 3. 1-dev
//                  $scope.data_analysis[0].push($analyzer.get1dev(frame_x));
//                  $scope.data_analysis[1].push($analyzer.get1dev(frame_y));
//                  $scope.data_analysis[2].push($analyzer.get1dev(frame_z));
//              }
//
//              $scope.labels_analysis.push('-');
//          }
//
//      }, function(err) {
//        // An error occurred. Show a message to the user
//      });
//    }, 25);
//
//  };
//
//  $scope.stopCollection = function() {
//
//    if (angular.isDefined(stop)) {
//      $interval.cancel(stop);
//      stop = undefined;
//      $scope.change_mode = true;
//      $scope.isCollecting = false;
//      $scope.recording_message = "";
//    }
//  };
//
//  $scope.startAnalysis = function() {
//        $scope.stopCollection();
//        $state.go('analysis', {raw_data: {data: $scope.data, labels: $scope.labels}});
//  };
//
//  $scope.sendGesture = function() {
//        $scope.stopCollection();
//        $scope.series = ['Magnitude'];
//        $scope.data = [
//            [] // x
//        ];
//        $scope.timestamp = [];
//        $scope.labels = [];
//
//        $scope.change_mode = false;
//        $scope.data_analysis = [
//                [], // For_X
//                [], // For_Y
//                []  // For_Z
//        ];
//        $scope.labels_analysis = [];
//        $scope.feature_graph = false;
//
//        $scope.isCollecting = true;
//        $scope.recording_message = "잠시만 기다려주세요";
//        var isRecording = false;
//        var isStable = false;
//
//        // recorded gesture
//        var recorded_data = [
//            [], // For_X
//            [], // For_Y
//            [], // For_Z
//            []  // Magnitude
//        ];
//        var recorded_labels = [];
//
//        // start collection...
//        var gravity = [0, 0, 0];
//        stop = $interval(function() {
//          // get accelerometer data
//          $cordovaDeviceMotion.getCurrentAcceleration().then(function(result) {
//
//              // set raw data
//              if($scope.data[0].length > 30) {
//                 $scope.data[0].shift();
//                 $scope.timestamp.shift();
//                 $scope.labels.shift();
//              }
//
//              // remove gravity
//              var alpha = 0.8;
//
//              gravity[0] = alpha * gravity[0] + (1 - alpha) * result.x;
//              gravity[1] = alpha * gravity[1] + (1 - alpha) * result.y;
//              gravity[2] = alpha * gravity[2] + (1 - alpha) * result.z;
//
//              var x = result.x - gravity[0];
//              var y = result.y - gravity[1];
//              var z = result.z - gravity[2];
//              var magnitude = Math.sqrt(x * x + y * y + z * z);
//
//              $scope.data[0].push(magnitude);
//              $scope.labels.push('-');
//              $scope.timestamp.push(result.timestamp);
//
//              // threshold
//              // if length is not enough
//              var avg_magnitude = 10;
//              // if length enough
//              if(recorded_labels.length > 10) {
//                  var frame_size = 5;
//                  var sum_magnitude = 0;
//                  for(var i = recorded_data[3].length - frame_size; i < recorded_data[3].length; i++)
//                      sum_magnitude = sum_magnitude + recorded_data[3][i];
//                  avg_magnitude = (sum_magnitude + magnitude) / (frame_size + 1);
//              }
//
//              // after smoothing (i.e., removing gravity)
//              if($scope.data[0].length > 30 && isStable === false) {
//                  isStable = true;
//                  $scope.recording_message = "제스처를 시작해주세요";
//              }
//
//              if(isStable === true) {
//                if(magnitude > 3 && isRecording === false && recorded_labels.length === 0) {
//                    isRecording = true;
//                    $scope.recording_message = "제스처 수집중";
//                } else if(avg_magnitude < 2 && isRecording === true && recorded_labels.length > 10) {
//                    $scope.recording_message = "제스처 수집 종료";
//                    isRecording = false;
//                    $scope.stopCollection();
//
//                    // show data;
//                    $scope.series = ['X', 'Y', 'Z'];
//                    $scope.data = [[],[],[]];
//                    $scope.data[0] = recorded_data[0];
//                    $scope.data[1] = recorded_data[1];
//                    $scope.data[2] = recorded_data[2];
//                    $scope.labels = recorded_labels;
//
//                   //show confirm dialog
//                   // An elaborate, custom popup
//                   $scope.data = {};
//                   var confirmPopup = $ionicPopup.show({
//                     template: '<input ng-model="data.id">',
//                     title: 'Enter Ground ID',
//                     subTitle: 'Please use normal things',
//                     scope: $scope,
//                     buttons: [
//                       { text: 'Cancel' },
//                       {
//                         text: '<b>Save</b>',
//                         type: 'button-positive',
//                         onTap: function(e) {
//                             return $scope.data.id;
//                         }
//                       }
//                     ]
//                   });
//                   confirmPopup.then(function(res) {
//                     if(res) {
//                         var body = {
//                            ground_name: $scope.data.id,
//                            accel_x: recorded_data[0],
//                            accel_y: recorded_data[1],
//                            accel_z: recorded_data[2]
//                        };
//                        $communication.saveGround(body, function(res) {
//                            if(res.type === true) {
//                                alert('성공적으로 저장하였습니다.');
//                            } else {
//                                alert('저장에 실패하였습니다.');
//                            }
//                        }, function() {
//                            console.log('error');
//                        })
//                     }
//                   });
//
//                }
//              }
//
//              // record gesture
//              if(isRecording) {
//                recorded_data[0].push(x);
//                recorded_data[1].push(y);
//                recorded_data[2].push(z);
//                recorded_data[3].push(magnitude);
//                recorded_labels.push('-');
//              }
//
//          }, function(err) {
//            // An error occurred. Show a message to the user
//          });
//        }, 25);
//
//  };
//
//  $scope.goDemo = function() {
//         $scope.stopCollection();
//         $state.go('demo');
//  };
//
//  $scope.saveCollection =  function() {
//
//      $scope.collection = {};
//      console.log('save collection');
//      var collectionPopup = $ionicPopup.show({
//         template: '<input ng-model="collection.collection_popup_name">',
//         title: 'Enter Collection ID',
//         subTitle: 'Please use normal things',
//         scope: $scope,
//         buttons: [
//           { text: 'Cancel' },
//           {
//             text: '<b>Save</b>',
//             type: 'button-positive',
//             onTap: function(e) {
//                 return $scope.collection.collection_popup_name;
//             }
//           }
//         ]
//       });
//       collectionPopup.then(function(res) {
//         if(res) {
//
//            var body = {
//              series: $scope.series,
//              data: $scope.data,
//              collection_name: $scope.collection.collection_popup_name
//            };
//
//          $communication.saveCollection(body, function(res) {
//            if(res.type) {
//                console.log('save collection success');
//            } else {
//                console.log('save collection fail');
//            }
//          }, function() {
//                console.log('save collection fail');
//          });
//
//         }
//       });
//
//
//  };
//
//})
//
//.controller('analysisCtrl', function($scope, $ionicHistory, $stateParams, $communication, $analyzer) {
//    $scope.menu_graph = true;
//    $scope.menu_feature = false;
//    $scope.menu_method = false;
//
//    $scope.changeMenu = function(menu) {
//        $scope.menu_graph = false;
//        $scope.menu_feature = false;
//        $scope.menu_method = false;
//
//        if(menu === 'Graph')
//            $scope.menu_graph = true;
//        if(menu === 'Feature')
//            $scope.menu_feature = true;
//        if(menu === 'Method')
//            $scope.menu_method = true;
//
//    };
//
//    $scope.goBack = function() {
//        $ionicHistory.goBack();
//    };
//
//    $scope.option = {animation: false, pointDot: false, datasetFill : false, showTooltips: false };
//
//    $scope.option_ground = {animation: false, pointDot: false, datasetFill : false, showTooltips: false};
//
//    $scope.option_analysis = {animation: false, pointDot: false, datasetFill : false, showTooltips: false};
//
//    $scope.raw_graph = true;
//    $scope.ground_graph = true;
//    $scope.analysis_graph = false;
//
//    $scope.analysis_available = false;
//
//    // set raw data
//    $scope.series = ['X', 'Y', 'Z'];
//    var raw_data = $stateParams.raw_data.data;
//    var raw_length = Math.min(raw_data[0].length, raw_data[1].length, raw_data[2].length);
//    var filtered_data = [[],[],[]];
//    for(var i = 0; i < raw_length; i++) {
//        filtered_data[0].push(raw_data[0][i]);
//        filtered_data[1].push(raw_data[1][i]);
//        filtered_data[2].push(raw_data[2][i]);
//    }
//    $scope.data = filtered_data;
//    $scope.labels = $stateParams.raw_data.labels;
//
//    // set ground data
//    $scope.series_ground = ['Ground_X', 'Ground_Y', 'Ground_Z'];
//    $scope.data_ground = [
//        [], // For X
//        [], // For Y
//        []  // For Z
//    ];
//
//    // 분석 시작
//    var ground_gestures = [];
//    var body = {};
//    // 1. get ground gesture from sever
//    $communication.getGround(body, function(res) {
//
//        if(res.type === true){
//            var num_gestures = res.data.length;
//            for(i = 0; i < num_gestures; i++) {
//                var ground_id = res.data[i].template_name;
//                var ground_data = [
//                    [], // For X
//                    [], // For Y
//                    []
//                ];
//
//                ground_data[0] = res.data[i].accel_x;
//                ground_data[1] = res.data[i].accel_y;
//                ground_data[2] = res.data[i].accel_z;
//                ground_gestures.push({ground_id: ground_id, ground_data: ground_data});
//            }
//
//            // 2. show gesture graph
//            $scope.data_ground = ground_gestures[0].ground_data;
//            $scope.analysis_available = true;
//            var labels = [];
//            for(var i = 0; i < ground_gestures[0].ground_data[0].length; i++) {
//                labels.push('-');
//            }
//            $scope.labels_ground = labels;
//        }
//
//    }, function() {
//        console.log('error');
//    });
//
//    // feature set
//    $scope.feature_x = true;
//    $scope.feature_y = true;
//    $scope.feature_z = true;
//    $scope.feature_magnitude = true;
//    $scope.feature_x_dev = true;
//    $scope.feature_y_dev = true;
//    $scope.feature_z_dev = true;
//
//    $scope.startAnalysis = function() {
//
//        // Initialize
//        $scope.raw_graph = true;
//        $scope.ground_graph = false;
//        $scope.analysis_graph = true;
//
//        // set analysis data
//        $scope.series_analysis = new Array(ground_gestures.length);
//        for(i = 0; i < ground_gestures.length; i++)
//                $scope.series_analysis[i] = ground_gestures[i].ground_id;
//
//        // Ground Features
//        var featured_gestures = [];
//        var num_gestures = ground_gestures.length;
//        for(var k = 0; k < num_gestures; k++) {
//            var ground_data = ground_gestures[k].ground_data;
//
//            var ground_features = [];
//            var ground_data_length = ground_data[0].length;
//            // set features of ground data
//            // i === 1 인 이유는 dev 때문에
//            for(var i = 1; i < ground_data_length; i++) {
//                var ground_feature = [];
//                if($scope.feature_x)
//                    ground_feature.push(ground_data[0][i]);
//                if($scope.feature_y)
//                    ground_feature.push(ground_data[1][i]);
//                if($scope.feature_z)
//                    ground_feature.push(ground_data[2][i]);
//                if($scope.feature_magnitude)
//                    ground_feature.push(Math.sqrt(ground_data[0][i]*ground_data[0][i] + ground_data[1][i]*ground_data[1][i] + ground_data[2][i]*ground_data[2][i]));
//                if($scope.feature_x_dev)
//                    ground_feature.push(ground_data[0][i] - ground_data[0][i-1]);
//                if($scope.feature_y_dev)
//                    ground_feature.push(ground_data[1][i] - ground_data[1][i-1]);
//                if($scope.feature_z_dev)
//                    ground_feature.push(ground_data[2][i] - ground_data[2][i-1]);
//
//                ground_features.push(ground_feature);
//            }
//            featured_gestures.push({ground_id: ground_gestures[k].ground_id, ground_features: ground_features});
//        }
//
//        // Test Features
//        var frame_size = 30;
//        var similarities = [];
//        var labels_analysis = [];
//        for(k=0; k <num_gestures; k++) {
//            similarities.push([]);
//        }
//
//        for(i = 1; i < $scope.data[0].length - frame_size; i++) {
//            // 1. Create Frame with features
//            var frame_features = [];
//            for(var j = 0; j < frame_size; j++) {
//                var frame_feature = [];
//                if($scope.feature_x)
//                    frame_feature.push($scope.data[0][i+j]);
//                if($scope.feature_y)
//                    frame_feature.push($scope.data[1][i+j]);
//                if($scope.feature_z)
//                    frame_feature.push($scope.data[2][i+j]);
//                if($scope.feature_magnitude)
//                    frame_feature.push(Math.sqrt($scope.data[0][i+j]*$scope.data[0][i+j] + $scope.data[1][i+j]*$scope.data[1][i+j] + $scope.data[2][i+j]*$scope.data[2][i+j]));
//                if($scope.feature_x_dev)
//                    frame_feature.push($scope.data[0][i+j] - $scope.data[0][i+j - 1]);
//                if($scope.feature_y_dev)
//                    frame_feature.push($scope.data[1][i+j] - $scope.data[1][i+j - 1]);
//                if($scope.feature_z_dev)
//                    frame_feature.push($scope.data[2][i+j] - $scope.data[2][i+j - 1]);
//
//                frame_features.push(frame_feature);
//            }
//
//            // 2. Get DTW value
//            for(k=0; k < num_gestures; k++) {
//                similarities[k].push($analyzer.getSimilarity(featured_gestures[k].ground_features, frame_features));
//            }
//
//            labels_analysis.push('-');
//        }
//
//
//        for(k = 0; k < num_gestures; k++) {
//            var last_value = similarities[k][similarities[k].length - 1];
//            for(i = 0; i < frame_size; i++) {
//                similarities[k].push(last_value);
//            }
//        }
//        for(i = 0; i < frame_size; i++)
//            labels_analysis.push('-');
//
//
//        //3. show graph
//        $scope.data_analysis = similarities;
//        $scope.labels_analysis = labels_analysis;
//    };
//
//    // normalize
//    $scope.normalize = function() {
//        // raw data normalization
//        var data_length = $scope.data[0].length;
//        var normalized_data = [[],[],[]];
//        for(var i = 0; i < data_length; i++) {
//            var magnitude = Math.sqrt($scope.data[0][i] * $scope.data[0][i] + $scope.data[1][i] * $scope.data[1][i] + $scope.data[2][i] * $scope.data[2][i]);
//            normalized_data[0].push($scope.data[0][i] / magnitude);
//            normalized_data[1].push($scope.data[1][i] / magnitude);
//            normalized_data[2].push($scope.data[2][i] / magnitude);
//        }
//        $scope.data = normalized_data;
//
//        // ground data normalization
//        var num_gestures = ground_gestures.length;
//        var normalized_ground_gestures = new Array(num_gestures);
//
//        for(var k = 0; k < num_gestures; k++) {
//            var ground_id = ground_gestures[k].ground_id;
//            var ground_data = ground_gestures[k].ground_data;
//
//
//            var ground_data_length = ground_data[0].length;
//            var normalized_ground_data = [[],[],[]];
//
//            for(i = 0; i < ground_data_length; i++) {
//                var ground_magnitude = Math.sqrt(ground_data[0][i] * ground_data[0][i] + ground_data[1][i] * ground_data[1][i] + ground_data[2][i] * ground_data[2][i]);
//                normalized_ground_data[0].push(ground_data[0][i] / ground_magnitude);
//                normalized_ground_data[1].push(ground_data[1][i] / ground_magnitude);
//                normalized_ground_data[2].push(ground_data[2][i] / ground_magnitude);
//            }
//
//            normalized_ground_gestures[k] = {ground_id: ground_id, ground_data: normalized_ground_data};
//        }
//
//        ground_gestures = normalized_ground_gestures;
//        // 2. show gesture graph
//        $scope.data_ground = normalized_ground_gestures[0].ground_data;
//    };
//
//    $scope.denormalize = function() {
//        $scope.data = $stateParams.raw_data.data;
//        var body = {};
//        // 1. get ground gesture from sever
//        $communication.getGround(body, function(res) {
//            if(res.type === true ){
//                ground_data[0] = res.data.accel_x;
//                ground_data[1] = res.data.accel_y;
//                ground_data[2] = res.data.accel_z;
//
//                // 2. show gesture graph
//                $scope.data_ground = ground_data;
//                $scope.analysis_available = true;
//                var labels = [];
//                for(var i = 0; i < ground_data[0].length; i++) {
//                    labels.push('-');
//                }
//                $scope.labels_ground = labels;
//            }
//        }, function() {
//            console.log('error');
//        });
//    };
//
//})
//
//.controller('demoCtrl', function($scope, $rootScope, $localstorage, $ionicHistory, $communication, $analyzer, $interval, $cordovaDeviceMotion, $state, $socket, $cordovaMedia, $cordovaVibration) {
//
//
//    console.log('demo Controller');
//
//    var my_name = $localstorage.getID();
//    console.log('my_name  ' + my_name);
//
//
//    // socket init
//    $scope.socket = $socket.getSocket();
//    $scope.socket.emit('Add User', my_name);
//
//    $scope.option = {animation: false, pointDot: false, datasetFill : false,
//                    scaleOverride : true, scaleSteps : 8, scaleStepWidth : 5, scaleStartValue : -20 };
//
//    $scope.option_analysis = {animation: false, pointDot: false, datasetFill : false,
//                     scaleOverride : true, scaleSteps : 8, scaleStepWidth : 3, scaleStartValue : 0 };
//
//    $scope.received_channel = "None Yet";
//
//    // resume and pause
//    $rootScope.$watch('eventHappen', function() {
//        console.log($rootScope.eventHappen);
//        if($rootScope.eventHappen === "pause") {
//            $scope.socket.emit('Disconnect', my_name);
//        } else if($rootScope.eventHappen === "resume") {
//            $scope.socket.emit('Add User', my_name);
//        }
//    });
//
//    var left_src = "/audio/Left.mp3";
//    var left_media = $cordovaMedia.newMedia(left_src);
//
//    var right_src = "/audio/Right.mp3";
//    var right_media = $cordovaMedia.newMedia(right_src);
//
//    // socket on
//    $scope.socket.on('Rhythm', function(data) {
//        $scope.received_channel = 'Rhythm ' + data;
//        if(data === "Left") {
//            left_media.play(); // iOS only!
//        } else if (data === "Right") {
//            right_media.play(); // iOS only!
//        }
//    });
//
//    $scope.socket.on('Synchronized', function(data) {
//        console.log('Synchronized Event : ' + data);
//        $cordovaVibration.vibrate(3000);
//    });
//
//    $scope.socket.on('connect',function(){
//        console.log('connected');
//    });
//
//    // template을 서버에서 가져오기
//    // global template_dictionary
//    var template_dictionary = {};
//    // 분석을 위해 normalized 된 template feature
//    $scope.featured_templates = {};
//    // get template
//    $communication.getTemplates(function(res) {
//        if(res.type) {
//            console.log('get Templates success : # of templates = ' + res.data.length);
//            var temp_dic = {};
//            var templates = res.data;
//            templates.forEach(function(template) {
//                temp_dic[template.template_name] = template;
//            });
//            template_dictionary = temp_dic;
//
//            // normalize
//            // template data normalization
//            var template_keys = [];
//            for (var key in template_dictionary) {
//                if(template_dictionary.hasOwnProperty(key)) {
//                    template_keys.push(key);
//                }
//            }
//            console.log('normalize : template data / template_keys = ' + template_keys);
//            for(var k = 0; k < template_keys.length; k++) {
//                key = template_keys[k];
//                console.log(key);
//
//                var template_data_length = template_dictionary[key].accel_x.length;
//                var norm_accel_x = [];
//                var norm_accel_y = [];
//                var norm_accel_z = [];
//                for(i = 0; i < template_data_length; i++) {
//                    var template_magnitude = Math.sqrt(template_dictionary[key].accel_x[i] * template_dictionary[key].accel_x[i] + template_dictionary[key].accel_y[i] * template_dictionary[key].accel_y[i] + template_dictionary[key].accel_z[i] * template_dictionary[key].accel_z[i]);
//                    norm_accel_x.push(template_dictionary[key].accel_x[i] / template_magnitude);
//                    norm_accel_y.push(template_dictionary[key].accel_y[i] / template_magnitude);
//                    norm_accel_z.push(template_dictionary[key].accel_z[i] / template_magnitude);
//                }
//
//                template_dictionary[key].accel_x = norm_accel_x;
//                template_dictionary[key].accel_y = norm_accel_y;
//                template_dictionary[key].accel_z = norm_accel_z;
//            }
//
//            // template feature setting
//            var num_template = Object.keys(template_dictionary).length;
//            console.log('# of template : ' + num_template);
//            console.log('template names');
//            console.log(template_keys);
//
//            // set series
//            var series = [];
//            for(k = 0; k < template_keys.length; k++) {
//                series.push(template_dictionary[template_keys[k]].template_name);
//            }
//            $scope.series_analysis = series;
//
//            // Template Features
//            for(k = 0; k < template_keys.length; k++) {
//                console.log("Template name : " + template_dictionary[template_keys[k]].template_name);
//                var template_data = [];
//                template_data.push(template_dictionary[template_keys[k]].accel_x);
//                template_data.push(template_dictionary[template_keys[k]].accel_y);
//                template_data.push(template_dictionary[template_keys[k]].accel_z);
//
//                template_data_length = template_data[0].length;
//                console.log("Data Length : " + template_data_length);
//
//                var template_features = [];
//                for(var i = 1; i < template_data_length; i++) {
//                    var template_feature = [];
//                    template_feature.push(template_data[0][i]);
//                    template_feature.push(template_data[1][i]);
//                    template_feature.push(template_data[2][i]);
//                    template_features.push(template_feature);
//                }
//
//                $scope.featured_templates[template_dictionary[template_keys[k]].template_name] = template_features;
//            }
//
//            // set data_analysis
//            var similarities = []; // for each template
//
//            for(k = 0; k < num_template; k++) {
//                similarities.push([]);
//            }
//            $scope.data_analysis = similarities;
//            $scope.labels_analysis = [];
//        } else {
//            console.log('get Templates fail');
//        }
//    }, function() {
//        console.log('get Templates fail');
//    });
//
//
//    // 시작을 누르면 데이터를 수집하기
//    $scope.series = ['X', 'Y', 'Z'];
//    $scope.data = [
//        [], // x
//        [], // y
//        []  // z
//    ];
//    $scope.timestamp = [];
//    $scope.labels = [];
//
//    $scope.series_analysis = [];
//    $scope.data_analysis = [
//        [], // x
//        [] // y
//    ];
//    $scope.labels_analysis = [];
//
//    var total_sample_size = 100;
//    var stop;
//    var frame_size = 10;
//    var window_size = 1;
//
//    $scope.collection_features = [];
//    $scope.analysis_index = 0;
//    $scope.collection_feature_magnitudes = [];
//
//    $scope.sum_magnitude = 0;
//
//    $scope.startCollection = function() {
//
//        if ( angular.isDefined(stop) ) return;
//
//        // initialize raw mode
//        $scope.series = ['X', 'Y', 'Z'];
//        $scope.data = [
//            [], // x
//            [], // y
//            []  // z
//        ];
//        $scope.timestamp = [];
//        $scope.labels = [];
//
//        //
//        $scope.collection_features = [];
//        $scope.current_state = "Nothing";
//
//        $scope.state_style = {"background-color":"white"};
//
//        // start collecting
//        var gravity = [0, 0, 0];
//        stop = $interval(function() {
//          // get accelerometer data
//          $cordovaDeviceMotion.getCurrentAcceleration().then(function(result) {
//
//              var changed = false;
//
//              // set raw data
//              if($scope.data[0].length > total_sample_size) {
//                 $scope.data[0].shift();
//                 $scope.data[1].shift();
//                 $scope.data[2].shift();
//                 $scope.timestamp.shift();
//                 $scope.labels.shift();
//              }
//
//              // shift analysis data
//              if($scope.data_analysis[0].length > total_sample_size) {
//                  for(k = 0; k < $scope.series_analysis.length; k++) {
//                      $scope.data_analysis[k].shift();
//                  }
//                  $scope.labels_analysis.shift();
//              }
//
//              // calculate distance
//              if($scope.collection_features.length > frame_size) {
//                 $scope.collection_features.shift();
//                 $scope.collection_feature_magnitudes.shift();
//
//                 var sum = 0;
//                 for(var i = 0; i < $scope.collection_feature_magnitudes.length; i++) {
//                    sum += $scope.collection_feature_magnitudes[i];
//                 }
//
//                 $scope.avg_magnitude = sum / $scope.collection_feature_magnitudes.length;
//
//                 if($scope.analysis_index % 2 == 0) {
//
//                     if($scope.avg_magnitude > 2.0) {
//
//                         for (var k = 0; k < $scope.series_analysis.length; k++) {
//                             var distance = $analyzer.getSimilarity($scope.featured_templates[$scope.series_analysis[k]], $scope.collection_features);
//                             $scope.data_analysis[k].push(distance);
//                             if(distance < 7) {
//                                if($scope.current_state != $scope.series_analysis[k])
//                                    changed = true;
//                                $scope.current_state = $scope.series_analysis[k];
//                             }
//                         }
//
//                         if($scope.current_state === 'Left' && changed) {
//                            $scope.socket.emit('Rhythm', {state: 'Left', name: my_name});
//                            $scope.state_style = {"background-color":"#EF4444"};
//                            $scope.sum_magnitude = sum;
//                         }
//
//                         else if($scope.current_state === 'Right' && changed) {
//                            $scope.socket.emit('Rhythm', {state: 'Right', name: my_name});
//                            $scope.state_style = {"background-color":"#394BA0"};
//                            $scope.sum_magnitude = sum;
//
//                         }
//
//                     } else {
//                        for(k = 0; k < $scope.series_analysis.length; k++) {
//                            $scope.data_analysis[k].push(null);
//                        }
//                     }
//
//                 } else {
//                    for(k = 0; k < $scope.series_analysis.length; k++) {
//                        $scope.data_analysis[k].push(null);
//                    }
//                 }
//                 $scope.labels_analysis.push('-');
//              }
//
//              // remove gravity
//              var alpha = 0.8;
//
//              gravity[0] = alpha * gravity[0] + (1 - alpha) * result.x;
//              gravity[1] = alpha * gravity[1] + (1 - alpha) * result.y;
//              gravity[2] = alpha * gravity[2] + (1 - alpha) * result.z;
//
//
//              $scope.data[0].push(result.x - gravity[0]);
//              $scope.data[1].push(result.y - gravity[1]);
//              $scope.data[2].push(result.z - gravity[2]);
//              $scope.labels.push('-');
//              $scope.timestamp.push(result.timestamp);
//
//              // normalize and make collection_features
//              var frame_feature = [];
//              var magnitude = Math.sqrt((result.x - gravity[0]) * (result.x - gravity[0]) + (result.y - gravity[1]) * (result.y - gravity[1]) + (result.z - gravity[2]) * (result.z - gravity[2]));
//              frame_feature.push((result.x - gravity[0]) / magnitude);
//              frame_feature.push((result.y - gravity[1]) / magnitude);
//              frame_feature.push((result.z - gravity[2]) / magnitude);
//              $scope.collection_features.push(frame_feature);
//              $scope.collection_feature_magnitudes.push(magnitude);
//
//              $scope.analysis_index++;
//
//          }, function(err) {
//            // An error occurred. Show a message to the user
//          });
//        }, 25);
//
//    };
//
//    $scope.stopCollection = function() {
//
//        if (angular.isDefined(stop)) {
//          $interval.cancel(stop);
//          stop = undefined;
//          $scope.change_mode = true;
//          $scope.isCollecting = false;
//          $scope.recording_message = "";
//        }
//
//    };
//
//    $scope.goHome = function() {
//       $scope.stopCollection();
//       $state.go('home');
//    };
//
//
//    $scope.emitLeft = function() {
//        $scope.socket.emit('Rhythm', {state: 'Left', name: my_name});
//    };
//
//    $scope.emitRight = function() {
//        $scope.socket.emit('Rhythm', {state: 'Right', name: my_name});
//    };
//
//})
//
//.controller('ozCtrl', function($scope, $rootScope, $localstorage, $ionicHistory, $communication, $analyzer, $interval, $cordovaDeviceMotion, $state, $socket, $cordovaMedia, $cordovaVibration, $window) {
//
//    var my_name = $localstorage.getID();
//    console.log('Oz Controller : ' + my_name);
//
//    var my_index = -1;
//
//    // CSS ng styles
//    $scope.style_notconnected = {"background-color" : "black", "color": "white"};
//    $scope.message_notconnected = "접속되지 않음";
//    $scope.style_connected = {"background-color" : "#404040", "color": "white"};
//    $scope.message_connected = "접속됨. 준비 완료!";
//    $scope.style_notsynched = {"background-color" : "white", "color": "black"};
//    $scope.message_notsynched = "리듬에 맞춰서 제스처를 해주세요!";
//    $scope.style_synched = {"background-color" : "#01FF70", "color": "black"};
//    $scope.message_synched = "싱크가 되었습니다!";
//
//    $scope.origin_information = {"id":"Origin","style":$scope.style_notconnected,"me":false,"message":$scope.message_notconnected};
//    $scope.user1_information = {"id":"User1","style":$scope.style_notconnected,"me":false,"message":$scope.message_notconnected};
//    $scope.user2_information = {"id":"User2","style":$scope.style_notconnected,"me":false,"message":$scope.message_notconnected};
//
//    // Socket functions
//    $scope.socket = $socket.getSocket();
//    $scope.received_channel = "None Yet";
//
//    $scope.socket.on('connect',function(){
//        console.log('successfully connected');
//    });
//
//    // Login with ID
//    $scope.socket.emit('Login', my_name);
//
//    // 누군가 새로 들어온 경우에 Connected
//    $scope.socket.on('Connected', function(data) {
//        console.log(JSON.stringify(data));
//        var me = $localstorage.getID();
//
//        // UI update
//        for (var key in data) {
//          var index = data[key]["index"];
//          console.log(index);
//
//          if(index === 0) {
//            //Origin
//            $scope.origin_information.style = $scope.style_connected; // style
//            $scope.origin_information.message = $scope.message_connected; //Text
//            if(me === key) {
//                $scope.origin_information.me = true; // Me
//                my_index = 0;
//            }
//
//
//          } else if(index === 1) {
//            // User1
//            $scope.user1_information.id = key; // ID
//            $scope.user1_information.style = $scope.style_connected; // style
//            $scope.user1_information.message = $scope.message_connected; //Text
//            if(me === key) {
//                $scope.user1_information.me = true; // Me
//                my_index = 1;
//            }
//
//
//          } else if(index === 2) {
//            // User2
//            $scope.user2_information.id = key; // ID
//            $scope.user2_information.style = $scope.style_connected; // style
//            $scope.user2_information.message = $scope.message_connected; //Text
//            if(me === key) {
//                $scope.user2_information.me = true; // Me
//                my_index = 2;
//            }
//
//          }
//        }
//    });
//
//    $scope.socket.on('Started', function(data) {
//        console.log('Started');
//        $scope.origin_information.style = $scope.style_synched;
//        $scope.origin_information.message = $scope.message_synched;
//        $scope.user1_information.style = $scope.style_notsynched;
//        $scope.user1_information.message = $scope.message_notsynched;
//        $scope.user2_information.style = $scope.style_notsynched;
//        $scope.user2_information.message = $scope.message_notsynched;
//        $scope.startCollection();
//    });
//
//    $scope.socket.on('Stopped', function(data) {
//        console.log('Stopped');
//        console.log(JSON.stringify(data));
//         // UI update
//        for (var key in data) {
//          var index = data[key]["index"];
//          console.log(index);
//
//          if(index === 0) {
//            //Origin
//            $scope.origin_information.style = $scope.style_connected; // style
//            $scope.origin_information.message = $scope.message_connected;
//            if(me === key)
//                $scope.origin_information.me = true; // Me
//
//          } else if(index === 1) {
//            // User1
//            $scope.user1_information.id = key; // ID
//            $scope.user1_information.style = $scope.style_connected; // style
//            $scope.user1_information.message = $scope.message_connected;
//            if(me === key)
//                $scope.user1_information.me = true; // Me
//
//          } else if(index === 2) {
//            // User2
//            $scope.user2_information.id = key; // ID
//            $scope.user2_information.style = $scope.style_connected; // style
//            $scope.user2_information.message = $scope.message_connected;
//            if(me === key)
//                $scope.user2_information.me = true; // Me
//          }
//        }
//
//        $scope.stopCollection();
//    });
//
//    // 누군가 Disconnected 된 경우에
//    $scope.socket.on('Disconnected', function(data) {
//      var index = data;
//      // UI update
//      console.log(index);
//      if(index === 0) {
//        //Origin
//        $scope.origin_information = {"id":"Origin","style":$scope.style_notconnected,"me":false,"message":$scope.message_notconnected};
//      } else if(index === 1) {
//        // User1
//        $scope.user1_information = {"id":"User1","style":$scope.style_notconnected,"me":false,"message":$scope.message_notconnected};
//      } else if(index === 2) {
//        $scope.user2_information = {"id":"User2","style":$scope.style_notconnected,"me":false,"message":$scope.message_notconnected};
//      }
//    });
//
//    var left_src = "/audio/Left.mp3";
//    var left_media = $cordovaMedia.newMedia(left_src);
//    left_media.setVolume(0.5);
//
//    var right_src = "/audio/Right.mp3";
//    var right_media = $cordovaMedia.newMedia(right_src);
//    right_media.setVolume(0.5);
//
//    var one_src = "/audio/One.mp3";
//    var one_media = $cordovaMedia.newMedia(one_src);
//    one_media.setVolume(1);
//
//    var two_src = "/audio/Two.mp3";
//    var two_media = $cordovaMedia.newMedia(two_src);
//    two_media.setVolume(1);
//
//    var three_src = "/audio/Three.mp3";
//    var three_media = $cordovaMedia.newMedia(three_src);
//    three_media.setVolume(1);
//
//    $scope.socket.on('Success', function(data) {
//        console.log(data);
//        if(data === '1') {
//            one_media.play();
//        } else if(data === '2') {
//            two_media.play();
//        } else if(data === '3') {
//            three_media.play();
//        }
//    });
//
//    $scope.socket.on('Completed', function(data) {
//        console.log('Completed');
//        $scope.socket.emit('Disconnect', my_name);
//        $scope.stopCollection();
//        $state.go('end');
//    });
//
//    $scope.socket.on('Rhythm', function(data) {
//        $scope.received_channel = 'Rhythm ' + data;
//        if(data === "Left") {
//            left_media.play(); // iOS only!
//        } else if (data === "Right") {
//            right_media.play(); // iOS only!
//        }
//    });
//
//    $scope.socket.on('Synchronized', function(data) {
//        console.log('Synchronized');
//        if(my_name === 'Origin')
//            $cordovaVibration.vibrate(3000);
//        else if(data.name === my_name)
//            $cordovaVibration.vibrate(3000);
//
//        var index = data.index;
//        console.log('index : ' + index);
//        if(index === 1) {
//            $scope.user1_information.style = $scope.style_synched;
//            $scope.user1_information.message = $scope.message_synched;
//        } else if(index === 2) {
//            $scope.user2_information.style = $scope.style_synched;
//            $scope.user2_information.message = $scope.message_synched;
//        }
//    });
//
//    $scope.socket.on('Nosynchronized', function(data) {
//        console.log('Nosynchronized');
//
//        var index = data.index;
//        console.log('index : ' + index);
//        if(index === 1) {
//            $scope.user1_information.style = $scope.style_notsynched;
//            $scope.user1_information.message = $scope.message_notsynched;
//        } else if(index === 2) {
//            $scope.user2_information.style = $scope.style_notsynched;
//            $scope.user2_information.message = $scope.message_notsynched;
//        }
//    });
//
//    // resume and pause
//    $rootScope.$watch('eventHappen', function() {
//        console.log($rootScope.eventHappen);
//        if($rootScope.eventHappen === "pause") {
//            $scope.socket.emit('Disconnect', my_name);
//        } else if($rootScope.eventHappen === "resume") {
//            $scope.socket.emit('Login', my_name);
//        }
//    });
//
//    var stop = undefined;
//
//    // Start Collection
//    $scope.startCollection = function() {
//        if ( angular.isDefined(stop) ) return;
//        console.log('started to test gesture');
//
//        // status
//        $scope.current_state = "Nothing";
//        $scope.state_style = {"background-color":"white"};
//
//        //
//        $scope.testing = true;
//        $scope.left_button_activate = false;
//        $scope.right_button_activate = false;
//
//        // initialize raw mode
//        $scope.collection_features = [];
//        $scope.collection_feature_magnitudes = [];
//        $scope.analysis_index = 0;
//
//        $scope.current_state = "Non";
//
//        // get templates from local storage
//
//        var left_template = $localstorage.getLeftTemplate()["left"];
//        var right_template = $localstorage.getRightTemplate()["right"];
//        console.log('Left Length : ' + left_template.length);
//        console.log('Right Length : ' + right_template.length);
//        var frame_size = Math.min(left_template.length, right_template.length); // 이거 어떻게 정해야하는지 고민되는 구만
//
//        $scope.left_distance = 0;
//        $scope.right_distance = 0;
//
//        var left_src = "/audio/Left.mp3";
//        var left_media = $cordovaMedia.newMedia(left_src);
//        left_media.setVolume(0.5);
//
//        var right_src = "/audio/Right.mp3";
//        var right_media = $cordovaMedia.newMedia(right_src);
//        right_media.setVolume(0.5);
//
//        // start collecting
//        var gravity = [0, 0, 0];
//        stop = $interval(function() {
//          // get accelerometer data
//          $cordovaDeviceMotion.getCurrentAcceleration().then(function(result) {
//
//              $scope.analysis_index++;
//
//              // calculate similarity
//              if($scope.collection_features.length > frame_size) {
//                 $scope.collection_features.shift();
//                 $scope.collection_feature_magnitudes.shift();
//
//                 // calculate average magnitude
//                 var sum = 0;
//                 for(var i = $scope.collection_feature_magnitudes.length - 5; i < $scope.collection_feature_magnitudes.length; i++)
//                    sum += $scope.collection_feature_magnitudes[i];
//                 $scope.avg_magnitude = sum / $scope.collection_feature_magnitudes.length;
//
//                 if($scope.analysis_index % 2 == 0) {
//                     // 현재 Left 인지 Right 인지로 구분해서 하면 되겠구나
//                     if($scope.current_state !== 'Left') {
//                        // Right or None
//                        var left_distance = $analyzer.getSimilarity(left_template, $scope.collection_features);
//                        if(left_distance < 15) {
//                            console.log('Left Gesture');
//                            $scope.socket.emit('Rhythm', {state: 'Left', name: my_name});
//                            $scope.current_state = 'Left';
//                            $scope.guide_message = 'Left';
//                            $scope.left_distance = left_distance;
//                            if(my_index == 0)
//                                $scope.origin_information.message = "당신의 제스처 : Left!";
//                            else if(my_index == 1)
//                                $scope.user1_information.message = "당신의 제스처 : Left!";
//                            else if(my_index == 2)
//                                $scope.user2_information.message = "당신의 제스처 : Left!";
//                        }
//                     } else if($scope.current_state !== 'Right') {
//                        var right_distance = $analyzer.getSimilarity(right_template, $scope.collection_features);
//                        if(right_distance < 15) {
//                            console.log('Right Gesture');
//                            $scope.socket.emit('Rhythm', {state: 'Right', name: my_name});
//                            $scope.current_state = 'Right';
//                            $scope.guide_message = 'Right';
//                            $scope.right_distance = right_distance;
//
//                            if(my_index == 0)
//                                $scope.origin_information.message = "당신의 제스처 : Right!";
//                            else if(my_index == 1)
//                                $scope.user1_information.message = "당신의 제스처 : Right!";
//                            else if(my_index == 2)
//                                $scope.user2_information.message = "당신의 제스처 : Right!";
//                        }
//                     }
//                 }
//              }
//
//              // remove gravity
//              var alpha = 0.8;
//              gravity[0] = alpha * gravity[0] + (1 - alpha) * result.x;
//              gravity[1] = alpha * gravity[1] + (1 - alpha) * result.y;
//              gravity[2] = alpha * gravity[2] + (1 - alpha) * result.z;
//
//              // normalize and make collection_features
//              var frame_feature = [];
//              var magnitude = Math.sqrt((result.x - gravity[0]) * (result.x - gravity[0]) + (result.y - gravity[1]) * (result.y - gravity[1]) + (result.z - gravity[2]) * (result.z - gravity[2]));
//              frame_feature.push((result.x - gravity[0]) / magnitude);
//              frame_feature.push((result.y - gravity[1]) / magnitude);
//              frame_feature.push((result.z - gravity[2]) / magnitude);
//              $scope.collection_features.push(frame_feature);
//              $scope.collection_feature_magnitudes.push(magnitude);
//
//          }, function(err) {
//            // An error occurred. Show a message to the user
//
//          });
//        }, 25);
//    };
//
//    // Stop Collection
//    $scope.stopCollection = function() {
//        if (angular.isDefined(stop)) {
//          $interval.cancel(stop);
//          stop = undefined;
//          $scope.change_mode = true;
//          $scope.isCollecting = false;
//          $scope.recording_message = "";
//        }
//    };
//
//    $scope.emitLeft = function() {
//        $scope.socket.emit('Rhythm', {state: 'Left', name: my_name});
//    };
//
//    $scope.emitRight = function() {
//        $scope.socket.emit('Rhythm', {state: 'Right', name: my_name});
//    };
//
//    $scope.goHome = function() {
//       $scope.stopCollection();
//       $state.go('home');
//    };
//
//    $scope.onExit = function() {
//      $scope.socket.emit('Disconnect', my_name);
//    };
//
//    $window.onbeforeunload =  $scope.onExit;
//
//})
//
//.controller('endCtrl', function($scope) {
//    console.log('endCtrl');
//
//})
//
//.controller('trainCtrl', function($scope, $interval, $cordovaDeviceMotion, $localstorage, $analyzer, $cordovaMedia, $state) {
//    console.log('trainCtrl');
//    $scope.guide_message = "Training을 시작해 주세요.";
//
//    // Sound Play test
//
//
//
//    $scope.left_button_activate = true;
//    $scope.right_button_activate = true;
//
//    if(Object.keys($localstorage.getLeftTemplate()).length == 0)
//        $scope.left_status = false;
//    else
//        $scope.left_status = true;
//
//    // right template
//    if(Object.keys($localstorage.getRightTemplate()).length == 0)
//        $scope.right_status = false;
//    else
//        $scope.right_status = true;
//
//    $scope.testing = false;
//
//    $scope.leftTrain = function() {
//        console.log('start to train a left gesture');
//        if (stop === undefined) {
//            $scope.startCollection('Left');
//        }
//    };
//
//    $scope.rightTrain = function() {
//        console.log('start to train a right gesture');
//        if (stop === undefined) {
//            $scope.startCollection('Right');
//        }
//    };
//
//    var stop = undefined;
//
//    $scope.startCollection = function(gesture) {
//        $scope.stopCollection();
//        $scope.guide_message = "기다려주세요";
//
//        // Data set
//        var recorded_data = [
//            [], // For_X
//            [], // For_Y
//            [] // For_Z
//        ];
//        var magnitude_array = [];
//
//        // Status Variables
//        var isRecording = false;
//        var isStable = false;
//
//        // start collection...
//        var gravity = [0, 0, 0];
//        stop = $interval(function() {
//          // get accelerometer data
//          $cordovaDeviceMotion.getCurrentAcceleration().then(function(result) {
//
//              // remove gravity
//              var alpha = 0.8;
//
//              gravity[0] = alpha * gravity[0] + (1 - alpha) * result.x;
//              gravity[1] = alpha * gravity[1] + (1 - alpha) * result.y;
//              gravity[2] = alpha * gravity[2] + (1 - alpha) * result.z;
//
//              var x = result.x - gravity[0];
//              var y = result.y - gravity[1];
//              var z = result.z - gravity[2];
//              var magnitude = Math.sqrt(x * x + y * y + z * z);
//
//              // add magnitude value to magnitude array
//              magnitude_array.push(magnitude);
//
//              var avg = 10000;  // Quite Large AVG
//              if(magnitude_array.length > 5) { // 5는 magnitude average 의 크기
//                var sum = 0;
//                for(var i = 0; i < magnitude_array.length; i++)
//                    sum += magnitude_array[i];
//                avg = sum / magnitude_array.length;
//                magnitude_array.shift();
//              }
//
//              if(isRecording === false && isStable === false) { // before stable
//                if(avg < 0.5) { // stable
//                    isStable = true;
//                    $scope.guide_message = "제스처를 시작해주세요";
//                }
//              } else if(isRecording === false && isStable === true) { // After stable
//                if(avg > 1.5) { // moving
//                    isRecording = true;
//                    $scope.guide_message = "제스처 수집중";
//                }
//              } else if(isRecording === true && isStable === true) {  // During Recording
//                if(avg < 1 && recorded_data[0].length > 10) {
//                    $scope.stopCollection();
//                    $scope.guide_message = "제스처 수집 종료";
//                    if(gesture === 'Left') {
//                        var left_template = [];
//                        for(var j = 0; j < recorded_data[0].length; j++) {
//                            var left_feature = [];
//                            var left_magnitude = Math.sqrt(recorded_data[0][j] * recorded_data[0][j] + recorded_data[1][j] * recorded_data[1][j] + recorded_data[2][j] * recorded_data[2][j]);
//                            left_feature.push(recorded_data[0][j] / left_magnitude); // x
//                            left_feature.push(recorded_data[1][j] / left_magnitude); // y
//                            left_feature.push(recorded_data[2][j] / left_magnitude); // z
//                            left_template.push(left_feature);
//                        }
//                        $localstorage.setLeftTemplate({left:left_template});
//                        $scope.left_status = true;
//                    } else if(gesture === 'Right') {
//                        var right_template = [];
//                        for(var k = 0; k < recorded_data[0].length; k++) {
//                            var right_feature = [];
//                            var right_magnitude = Math.sqrt(recorded_data[0][k] * recorded_data[0][k] + recorded_data[1][k] * recorded_data[1][k] + recorded_data[2][k] * recorded_data[2][k]);
//                            right_feature.push(recorded_data[0][k] / right_magnitude); // x
//                            right_feature.push(recorded_data[1][k] / right_magnitude); // y
//                            right_feature.push(recorded_data[2][k] / right_magnitude); // z
//                            right_template.push(right_feature);
//                        }
//                        $localstorage.setRightTemplate({right:right_template});
//                        $scope.right_status = true;
//                    }
//                } else {
//                    recorded_data[0].push(x);
//                    recorded_data[1].push(y);
//                    recorded_data[2].push(z);
//                }
//              }
//
//          }, function(err) {
//            // An error occurred. Show a message to the user
//          });
//        }, 25);
//    };
//
//    $scope.startTest = function() {
//
//        if ( angular.isDefined(stop) ) return;
//        console.log('started to test gesture');
//
//        //
//        $scope.testing = true;
//        $scope.left_button_activate = false;
//        $scope.right_button_activate = false;
//
//        // initialize raw mode
//        $scope.collection_features = [];
//        $scope.collection_feature_magnitudes = [];
//        $scope.analysis_index = 0;
//
//        $scope.current_state = "Non";
//
//        // get templates from local storage
//
//        var left_template = $localstorage.getLeftTemplate()["left"];
//        var right_template = $localstorage.getRightTemplate()["right"];
//        console.log('Left Length : ' + left_template.length);
//        console.log('Right Length : ' + right_template.length);
//        var frame_size = Math.min(left_template.length, right_template.length); // 이거 어떻게 정해야하는지 고민되는 구만
//
//        $scope.left_distance = 0;
//        $scope.right_distance = 0;
//
//        // sound
//        //var background_src = "/audio/background.mp3";
//        //var background_media = $cordovaMedia.newMedia(background_src);
//        //background_media.play();
//
//        var left_src = "/audio/Left.mp3";
//        var left_media = $cordovaMedia.newMedia(left_src);
//        left_media.setVolume(0.5);
//
//        var right_src = "/audio/Right.mp3";
//        var right_media = $cordovaMedia.newMedia(right_src);
//        right_media.setVolume(0.5);
//
//        // start collecting
//        var gravity = [0, 0, 0];
//        stop = $interval(function() {
//          // get accelerometer data
//          $cordovaDeviceMotion.getCurrentAcceleration().then(function(result) {
//
//              $scope.analysis_index++;
//
//              // calculate similarity
//              if($scope.collection_features.length > frame_size) {
//                 $scope.collection_features.shift();
//                 $scope.collection_feature_magnitudes.shift();
//
//                 // calculate average magnitude
//                 var sum = 0;
//                 for(var i = $scope.collection_feature_magnitudes.length - 5; i < $scope.collection_feature_magnitudes.length; i++)
//                    sum += $scope.collection_feature_magnitudes[i];
//                 $scope.avg_magnitude = sum / $scope.collection_feature_magnitudes.length;
//
//                 if($scope.analysis_index % 2 == 0) {
//                     // 현재 Left 인지 Right 인지로 구분해서 하면 되겠구나
//                     if($scope.current_state !== 'Left') {
//                        // Right or None
//                        var left_distance = $analyzer.getSimilarity(left_template, $scope.collection_features);
//                        if(left_distance < 15) {
//                            console.log('Left Gesture');
//                            $scope.current_state = 'Left';
//                            $scope.guide_message = 'Left';
//                            $scope.left_distance = left_distance;
//                            // 소리 Play
//                            //background_media.pause();
//                            left_media.play();
//                            //setTimeout(function(){ left_media.stop(); background_media.play(); }, 1000);
//                        }
//                     } else if($scope.current_state !== 'Right') {
//                        var right_distance = $analyzer.getSimilarity(right_template, $scope.collection_features);
//                        if(right_distance < 15) {
//                            console.log('Right Gesture');
//                            $scope.current_state = 'Right';
//                            $scope.guide_message = 'Right';
//                            $scope.right_distance = right_distance;
//                            // 소리 Play
//                            //background_media.pause();
//                            right_media.play();
//                            //setTimeout(function(){ right_media.stop(); background_media.play(); }, 1000);
//                        }
//                     }
//                 }
//              }
//
//              // remove gravity
//              var alpha = 0.8;
//              gravity[0] = alpha * gravity[0] + (1 - alpha) * result.x;
//              gravity[1] = alpha * gravity[1] + (1 - alpha) * result.y;
//              gravity[2] = alpha * gravity[2] + (1 - alpha) * result.z;
//
//              // normalize and make collection_features
//              var frame_feature = [];
//              var magnitude = Math.sqrt((result.x - gravity[0]) * (result.x - gravity[0]) + (result.y - gravity[1]) * (result.y - gravity[1]) + (result.z - gravity[2]) * (result.z - gravity[2]));
//              frame_feature.push((result.x - gravity[0]) / magnitude);
//              frame_feature.push((result.y - gravity[1]) / magnitude);
//              frame_feature.push((result.z - gravity[2]) / magnitude);
//              $scope.collection_features.push(frame_feature);
//              $scope.collection_feature_magnitudes.push(magnitude);
//
//          }, function(err) {
//            // An error occurred. Show a message to the user
//
//          });
//        }, 25);
//
//    };
//
//    $scope.stopCollection = function() {
//
//        if (angular.isDefined(stop)) {
//          $interval.cancel(stop);
//          stop = undefined;
//          $scope.testing = false;
//          $scope.left_button_activate = true;
//          $scope.right_button_activate = true;
//        }
//
//    };
//
//    $scope.imready = function() {
//        console.log("I'm Ready");
//        $state.go('login');
//    };
//
//})
//
//.controller('soundCtrl', function($scope, $cordovaNativeAudio, $timeout) {
//
//    $cordovaNativeAudio
//    .preloadComplex('music', '/audio/ambient.mp3',1,1)
//    .then(function (msg) {
//      console.log(msg);
//    }, function (error) {
//      console.error(error);
//    });
//
//    $scope.startBackground = function () {
//        console.log('start background music');
//        $cordovaNativeAudio.loop('music');
//    };
//
//    $scope.stopBackground = function () {
//        console.log('stop background music');
//        $cordovaNativeAudio.stop('music');
//        $cordovaNativeAudio.stop('effect');
//    };
//
//    $cordovaNativeAudio
//    .preloadSimple('effect', '/audio/snare.mp3')
//    .then(function (msg) {
//      console.log(msg);
//    }, function (error) {
//      console.error(error);
//    });
//
//    $scope.startEffect = function() {
//        console.log('start effect sound');
//        $cordovaNativeAudio.play('effect', new function(msg) {console.log(msg)});
//    };
//
//});



