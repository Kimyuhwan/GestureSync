angular.module('starter.controllers', [])

.controller('homeCtrl', function($scope, $cordovaDeviceMotion, $interval, $state, $analyzer, $communication, $ionicPopup) {

  $scope.option = {animation: false, pointDot: false, datasetFill : false,
                    scaleOverride : true, scaleSteps : 8, scaleStepWidth : 5, scaleStartValue : -20 };

  $scope.option_analysis = {animation: false, pointDot: false, datasetFill : false};

  $scope.raw_graph = true;
  $scope.feature_graph = true;

  // for feature data
  $scope.change_mode = true;
  $scope.feature_mode = "Avg";

  $scope.series = ['X', 'Y', 'Z'];
  $scope.data = [
        [], // x
        [], // y
        []  // z
  ];
  $scope.timestamp = [];
  $scope.labels = [];

  // for recording
  $scope.isCollecting = false;
  $scope.recording_message = "";

  var total_sample_size = 99;
  var stop;
  $scope.startCollection = function() {

    if ( angular.isDefined(stop) ) return;

    // initialize raw mode
    // for raw data
    $scope.series = ['X', 'Y', 'Z'];
    $scope.data = [
        [], // x
        [], // y
        []  // z
    ];
    $scope.timestamp = [];
    $scope.labels = [];

    // initialize analysis mode
    $scope.change_mode = false;
    $scope.data_analysis = [
            [], // For_X
            [], // For_Y
            []  // For_Z
    ];
    $scope.labels_analysis = [];

    if( $scope.feature_mode === "Avg") {
      $scope.series_analysis = ['AVG_X', 'AVG_Y', 'AVG_Z'];
    } else if($scope.feature_mode === "Std") {
      $scope.series_analysis = ['Std_X', 'Std_Y', 'Std_Z'];
    } else if($scope.feature_mode === "1-dev") {
      $scope.series_analysis = ['1Dev_X', '1Dev_Y', '1Dev_Z'];
    }

    // start collecting
    var gravity = [0, 0, 0];
    stop = $interval(function() {
      // get accelerometer data
      $cordovaDeviceMotion.getCurrentAcceleration().then(function(result) {

          // set raw data
          if($scope.data[0].length > total_sample_size) {
             $scope.data[0].shift();
             $scope.data[1].shift();
             $scope.data[2].shift();
             $scope.timestamp.shift();
             $scope.labels.shift();
          }

          // remove gravity
          var alpha = 0.8;

          gravity[0] = alpha * gravity[0] + (1 - alpha) * result.x;
          gravity[1] = alpha * gravity[1] + (1 - alpha) * result.y;
          gravity[2] = alpha * gravity[2] + (1 - alpha) * result.z;


          $scope.data[0].push(result.x - gravity[0]);
          $scope.data[1].push(result.y - gravity[1]);
          $scope.data[2].push(result.z - gravity[2]);
          $scope.labels.push('-');
          $scope.timestamp.push(result.timestamp);

          if($scope.data_analysis[0].length > total_sample_size) {
             $scope.data_analysis[0].shift();
             $scope.data_analysis[1].shift();
             $scope.data_analysis[2].shift();
             $scope.labels_analysis.shift();
          }

          // set feature data
          var window_size = 10.0;
          if($scope.data[0].length > window_size) {
              // create frame
              var frame_x = [];
              var frame_y = [];
              var frame_z = [];

              for(var i = $scope.data[0].length - window_size; i < $scope.data[0].length; i++) {
                    frame_x.push($scope.data[0][i]);
                    frame_y.push($scope.data[1][i]);
                    frame_z.push($scope.data[2][i]);
              }

              if($scope.feature_mode === 'Avg') {
                  // 1. average
                  $scope.data_analysis[0].push($analyzer.getAvg(frame_x));
                  $scope.data_analysis[1].push($analyzer.getAvg(frame_y));
                  $scope.data_analysis[2].push($analyzer.getAvg(frame_z));

              } else if ($scope.feature_mode === 'Std') {
                  // 2. std
                  $scope.data_analysis[0].push($analyzer.getStd(frame_x));
                  $scope.data_analysis[1].push($analyzer.getStd(frame_y));
                  $scope.data_analysis[2].push($analyzer.getStd(frame_z));

              } else if ($scope.feature_mode === '1-dev') {
                  // 3. 1-dev
                  $scope.data_analysis[0].push($analyzer.get1dev(frame_x));
                  $scope.data_analysis[1].push($analyzer.get1dev(frame_y));
                  $scope.data_analysis[2].push($analyzer.get1dev(frame_z));
              }

              $scope.labels_analysis.push('-');
          }

      }, function(err) {
        // An error occurred. Show a message to the user
      });
    }, 25);

  };

  $scope.stopCollection = function() {
    if (angular.isDefined(stop)) {
      $interval.cancel(stop);
      stop = undefined;
      $scope.change_mode = true;
      $scope.isCollecting = false;
      $scope.recording_message = "";
    }
  };

  $scope.startAnalysis = function() {
        $scope.stopCollection();
        $state.go('analysis', {raw_data: {data: $scope.data, labels: $scope.labels}});
  };

  $scope.sendGesture = function() {
        $scope.stopCollection();
        $scope.series = ['Magnitude'];
        $scope.data = [
            [] // x
        ];
        $scope.timestamp = [];
        $scope.labels = [];

        $scope.change_mode = false;
        $scope.data_analysis = [
                [], // For_X
                [], // For_Y
                []  // For_Z
        ];
        $scope.labels_analysis = [];
        $scope.feature_graph = false;

        $scope.isCollecting = true;
        $scope.recording_message = "잠시만 기다려주세요";
        var isRecording = false;
        var isStable = false;

        // recorded gesture
        var recorded_data = [
            [], // For_X
            [], // For_Y
            [], // For_Z
            []  // Magnitude
        ];
        var recorded_labels = [];

        // start collection...
        var gravity = [0, 0, 0];
        stop = $interval(function() {
          // get accelerometer data
          $cordovaDeviceMotion.getCurrentAcceleration().then(function(result) {

              // set raw data
              if($scope.data[0].length > 30) {
                 $scope.data[0].shift();
                 $scope.timestamp.shift();
                 $scope.labels.shift();
              }

              // remove gravity
              var alpha = 0.8;

              gravity[0] = alpha * gravity[0] + (1 - alpha) * result.x;
              gravity[1] = alpha * gravity[1] + (1 - alpha) * result.y;
              gravity[2] = alpha * gravity[2] + (1 - alpha) * result.z;

              var x = result.x - gravity[0];
              var y = result.y - gravity[1];
              var z = result.z - gravity[2];
              var magnitude = Math.sqrt(x * x + y * y + z * z);

              $scope.data[0].push(magnitude);
              $scope.labels.push('-');
              $scope.timestamp.push(result.timestamp);

              // threshold
              // if length is not enough
              var avg_magnitude = 10;
              // if length enough
              if(recorded_labels.length > 10) {
                  var frame_size = 5;
                  var sum_magnitude = 0;
                  for(var i = recorded_data[3].length - frame_size; i < recorded_data[3].length; i++)
                      sum_magnitude = sum_magnitude + recorded_data[3][i];
                  avg_magnitude = (sum_magnitude + magnitude) / (frame_size + 1);
              }

              // after smoothing (i.e., removing gravity)
              if($scope.data[0].length > 30 && isStable === false) {
                  isStable = true;
                  $scope.recording_message = "제스처를 시작해주세요";
              }

              if(isStable === true) {
                if(magnitude > 3 && isRecording === false && recorded_labels.length === 0) {
                    isRecording = true;
                    $scope.recording_message = "제스처 수집중";
                } else if(avg_magnitude < 1 && isRecording === true && recorded_labels.length > 10) {
                    $scope.recording_message = "제스처 수집 종료";
                    isRecording = false;
                    $scope.stopCollection();

                    // show data;
                    $scope.series = ['X', 'Y', 'Z'];
                    $scope.data = [[],[],[]];
                    $scope.data[0] = recorded_data[0];
                    $scope.data[1] = recorded_data[1];
                    $scope.data[2] = recorded_data[2];
                    $scope.labels = recorded_labels;


                   //show confirm dialog
                   // An elaborate, custom popup
                   $scope.data = {};
                   var confirmPopup = $ionicPopup.show({
                     template: '<input ng-model="data.id">',
                     title: 'Enter Ground ID',
                     subTitle: 'Please use normal things',
                     scope: $scope,
                     buttons: [
                       { text: 'Cancel' },
                       {
                         text: '<b>Save</b>',
                         type: 'button-positive',
                         onTap: function(e) {
                             return $scope.data.id;
                         }
                       }
                     ]
                   });
                   confirmPopup.then(function(res) {
                     if(res) {
                         var body = {
                            ground_id: $scope.data.id,
                            accel_x: recorded_data[0],
                            accel_y: recorded_data[1],
                            accel_z: recorded_data[2]
                        };
                        $communication.saveGround(body, function(res) {
                            if(res.type === true) {
                                alert('성공적으로 저장하였습니다.');
                            } else {
                                alert('저장에 실패하였습니다.');
                            }
                        }, function() {
                            console.log('error');
                        })
                     }
                   });

                }
              }

              // record gesture
              if(isRecording) {
                recorded_data[0].push(x);
                recorded_data[1].push(y);
                recorded_data[2].push(z);
                recorded_data[3].push(magnitude);
                recorded_labels.push('-');
              }

          }, function(err) {
            // An error occurred. Show a message to the user
          });
        }, 25);

  };

})

.controller('analysisCtrl', function($scope, $ionicHistory, $stateParams, $communication, $analyzer) {
    $scope.menu_graph = true;
    $scope.menu_feature = false;
    $scope.menu_method = false;

    $scope.changeMenu = function(menu) {
        $scope.menu_graph = false;
        $scope.menu_feature = false;
        $scope.menu_method = false;

        if(menu === 'Graph')
            $scope.menu_graph = true;
        if(menu === 'Feature')
            $scope.menu_feature = true;
        if(menu === 'Method')
            $scope.menu_method = true;

    };

    $scope.goBack = function() {
        $ionicHistory.goBack();
    };

    $scope.option = {animation: false, pointDot: false, datasetFill : false, showTooltips: false };

    $scope.option_ground = {animation: false, pointDot: false, datasetFill : false, showTooltips: false};

    $scope.option_analysis = {animation: false, pointDot: false, datasetFill : false, showTooltips: false};

    $scope.raw_graph = true;
    $scope.ground_graph = true;
    $scope.analysis_graph = false;

    $scope.analysis_available = false;

    // set raw data
    $scope.series = ['X', 'Y', 'Z'];
    var raw_data = $stateParams.raw_data.data;
    var raw_length = Math.min(raw_data[0].length, raw_data[1].length, raw_data[2].length);
    var filtered_data = [[],[],[]];
    for(var i = 0; i < raw_length; i++) {
        filtered_data[0].push(raw_data[0][i]);
        filtered_data[1].push(raw_data[1][i]);
        filtered_data[2].push(raw_data[2][i]);
    }
    $scope.data = filtered_data;
    $scope.labels = $stateParams.raw_data.labels;

    // set ground data
    $scope.series_ground = ['Ground_X', 'Ground_Y', 'Ground_Z'];
    $scope.data_ground = [
        [], // For X
        [], // For Y
        []  // For Z
    ];

    // 분석 시작
    var ground_gestures = [];
    var body = {};
    // 1. get ground gesture from sever
    $communication.getGround(body, function(res) {

        if(res.type === true){
            var num_gestures = res.data.length;
            for(i = 0; i < num_gestures; i++) {
                var ground_id = res.data[i].ground_id;
                var ground_data = [
                    [], // For X
                    [], // For Y
                    []
                ];

                ground_data[0] = res.data[i].accel_x;
                ground_data[1] = res.data[i].accel_y;
                ground_data[2] = res.data[i].accel_z;
                ground_gestures.push({ground_id: ground_id, ground_data: ground_data});
            }

            // 2. show gesture graph
            $scope.data_ground = ground_gestures[0].ground_data;
            $scope.analysis_available = true;
            var labels = [];
            for(var i = 0; i < ground_gestures[0].ground_data[0].length; i++) {
                labels.push('-');
            }
            $scope.labels_ground = labels;
        }

    }, function() {
        console.log('error');
    });

    // feature set
    $scope.feature_x = true;
    $scope.feature_y = true;
    $scope.feature_z = true;
    $scope.feature_magnitude = true;
    $scope.feature_x_dev = true;
    $scope.feature_y_dev = true;
    $scope.feature_z_dev = true;

    $scope.startAnalysis = function() {

        // Initialize
        $scope.raw_graph = true;
        $scope.ground_graph = false;
        $scope.analysis_graph = true;

        // set analysis data
        $scope.series_analysis = new Array(ground_gestures.length);
        for(i = 0; i < ground_gestures.length; i++)
                $scope.series_analysis[i] = ground_gestures[i].ground_id;

        // Ground Features
        var featured_gestures = [];
        var num_gestures = ground_gestures.length;
        for(var k = 0; k < num_gestures; k++) {
            var ground_data = ground_gestures[k].ground_data;

            var ground_features = [];
            var ground_data_length = ground_data[0].length;
            // set features of ground data
            // i === 1 인 이유는 dev 때문에
            for(var i = 1; i < ground_data_length; i++) {
                var ground_feature = [];
                if($scope.feature_x)
                    ground_feature.push(ground_data[0][i]);
                if($scope.feature_y)
                    ground_feature.push(ground_data[1][i]);
                if($scope.feature_z)
                    ground_feature.push(ground_data[2][i]);
                if($scope.feature_magnitude)
                    ground_feature.push(Math.sqrt(ground_data[0][i]*ground_data[0][i] + ground_data[1][i]*ground_data[1][i] + ground_data[2][i]*ground_data[2][i]));
                if($scope.feature_x_dev)
                    ground_feature.push(ground_data[0][i] - ground_data[0][i-1]);
                if($scope.feature_y_dev)
                    ground_feature.push(ground_data[1][i] - ground_data[1][i-1]);
                if($scope.feature_z_dev)
                    ground_feature.push(ground_data[2][i] - ground_data[2][i-1]);

                ground_features.push(ground_feature);
            }
            featured_gestures.push({ground_id: ground_gestures[k].ground_id, ground_features: ground_features});
        }

        // Test Features
        var frame_size = 30;
        var similarities = [];
        var labels_analysis = [];
        for(k=0; k <num_gestures; k++) {
            similarities.push([]);
        }

        for(i = 1; i < $scope.data[0].length - frame_size; i++) {
            // 1. Create Frame with features
            var frame_features = [];
            for(var j = 0; j < frame_size; j++) {
                var frame_feature = [];
                if($scope.feature_x)
                    frame_feature.push($scope.data[0][i+j]);
                if($scope.feature_y)
                    frame_feature.push($scope.data[1][i+j]);
                if($scope.feature_z)
                    frame_feature.push($scope.data[2][i+j]);
                if($scope.feature_magnitude)
                    frame_feature.push(Math.sqrt($scope.data[0][i+j]*$scope.data[0][i+j] + $scope.data[1][i+j]*$scope.data[1][i+j] + $scope.data[2][i+j]*$scope.data[2][i+j]));
                if($scope.feature_x_dev)
                    frame_feature.push($scope.data[0][i+j] - $scope.data[0][i+j - 1]);
                if($scope.feature_y_dev)
                    frame_feature.push($scope.data[1][i+j] - $scope.data[1][i+j - 1]);
                if($scope.feature_z_dev)
                    frame_feature.push($scope.data[2][i+j] - $scope.data[2][i+j - 1]);

                frame_features.push(frame_feature);
            }

            // 2. Get DTW value
            for(k=0; k < num_gestures; k++) {
                similarities[k].push($analyzer.getSimilarity(featured_gestures[k].ground_features, frame_features));
            }

            labels_analysis.push('-');
        }


        for(k = 0; k < num_gestures; k++) {
            var last_value = similarities[k][similarities[k].length - 1];
            for(i = 0; i < frame_size; i++) {
                similarities[k].push(last_value);
            }
        }
        for(i = 0; i < frame_size; i++)
            labels_analysis.push('-');


        //3. show graph
        $scope.data_analysis = similarities;
        $scope.labels_analysis = labels_analysis;
    };

    // normalize
    $scope.normalize = function() {
        // raw data normalization
        var data_length = $scope.data[0].length;
        var normalized_data = [[],[],[]];
        for(var i = 0; i < data_length; i++) {
            var magnitude = Math.sqrt($scope.data[0][i] * $scope.data[0][i] + $scope.data[1][i] * $scope.data[1][i] + $scope.data[2][i] * $scope.data[2][i]);
            normalized_data[0].push($scope.data[0][i] / magnitude);
            normalized_data[1].push($scope.data[1][i] / magnitude);
            normalized_data[2].push($scope.data[2][i] / magnitude);
        }
        $scope.data = normalized_data;

        // ground data normalization
        var num_gestures = ground_gestures.length;
        var normalized_ground_gestures = new Array(num_gestures);

        for(var k = 0; k < num_gestures; k++) {
            var ground_id = ground_gestures[k].ground_id;
            var ground_data = ground_gestures[k].ground_data;


            var ground_data_length = ground_data[0].length;
            var normalized_ground_data = [[],[],[]];

            for(i = 0; i < ground_data_length; i++) {
                var ground_magnitude = Math.sqrt(ground_data[0][i] * ground_data[0][i] + ground_data[1][i] * ground_data[1][i] + ground_data[2][i] * ground_data[2][i]);
                normalized_ground_data[0].push(ground_data[0][i] / ground_magnitude);
                normalized_ground_data[1].push(ground_data[1][i] / ground_magnitude);
                normalized_ground_data[2].push(ground_data[2][i] / ground_magnitude);
            }

            normalized_ground_gestures[k] = {ground_id: ground_id, ground_data: normalized_ground_data};
        }

        ground_gestures = normalized_ground_gestures;
        // 2. show gesture graph
        $scope.data_ground = normalized_ground_gestures[0].ground_data;
    };

    $scope.denormalize = function() {
        $scope.data = $stateParams.raw_data.data;
        var body = {};
        // 1. get ground gesture from sever
        $communication.getGround(body, function(res) {
            if(res.type === true ){
                ground_data[0] = res.data.accel_x;
                ground_data[1] = res.data.accel_y;
                ground_data[2] = res.data.accel_z;

                // 2. show gesture graph
                $scope.data_ground = ground_data;
                $scope.analysis_available = true;
                var labels = [];
                for(var i = 0; i < ground_data[0].length; i++) {
                    labels.push('-');
                }
                $scope.labels_ground = labels;
            }
        }, function() {
            console.log('error');
        });
    };

});
