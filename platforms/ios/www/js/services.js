angular.module('starter.services', [])

.factory('$localstorage', ['$window', function($window) {
        return {
            setID: function (value) {
                $window.localStorage['ID'] = value;
            },
            getID: function () {
                return $window.localStorage['ID']  || null;
            },
            setIndex: function (value) {
                $window.localStorage['Name'] = value;
            },
            getIndex: function () {
                return $window.localStorage['Name']  || null;
            },
            setComments: function (value) {
                $window.localStorage['Comments'] = value;
            },
            getComments: function () {
                return $window.localStorage['Comments']  || null;
            },
            setTemplate: function(key, value) {
                $window.localStorage[key] = JSON.stringify(value);
            },
            getTemplate: function(key) {
                return JSON.parse($window.localStorage[key] || '{}');
            }
        }
    }
])


.factory('$communication', ['$http', function($http){

        var baseUrl = "http://128.199.239.83:3000/";
        return {
            saveGround: function(data, success, error) {
                $http.post(baseUrl + 'gesture_test/save', data).success(success).error(error)
            },
            getGround: function(data, success, error) {
                $http.get(baseUrl + 'gesture_test/get', data).success(success).error(error)
            },
            saveCollection: function(data, success, error) {
                $http.post(baseUrl + 'gesture_test/collection', data).success(success).error(error)
            },
            getTemplates: function(success, error) {
                $http.get(baseUrl + 'gesture_test/gettemplate').success(success).error(error)
            }
        };

    }
])

.factory('$analyzer', [function() {
        var window_size = 10.0;

       function calAvg(frame) {
            var sum = 0;
            for(var i = 0; i < frame.length; i++) {
                sum = sum + frame[i];
            }
            return sum / window_size;
       }

       function calStd(frame) {
            var diff_sum = 0;
            var avg = calAvg(frame);

            for(var i = 0; i < frame.length; i++)
                diff_sum = diff_sum + ((avg - frame[i]) * (avg - frame[i]));

            return Math.sqrt(diff_sum / window_size);
       }

       function cal1dev(frame) {
            return frame[frame.length - 2] - frame[frame.length -1];
       }

       function calDTW(ground, frame) {
            var state = {
              distanceCostMatrix: null,
              distance: function (x, y) {
                  var sum_diff = 0;
                  for(var i = 0; i < x.length; i++) {
                      var difference = x[i] - y[i];
                      sum_diff = sum_diff + (difference * difference);
                  }
                  var euclideanDistance = sum_diff;
                  return euclideanDistance;
              }
          };

          var cost = Number.POSITIVE_INFINITY;
          cost = computeOptimalPath(ground, frame, state);
          return cost;
       }

       function computeOptimalPath(s, t, state) {
          var start = new Date().getTime();
          state.m = s.length;
          state.n = t.length;
          var distanceCostMatrix = createMatrix(state.m, state.n, Number.POSITIVE_INFINITY);

          distanceCostMatrix[0][0] = state.distance(s[0], t[0]);

          for (var rowIndex = 1; rowIndex < state.m; rowIndex++) {
              var cost = state.distance(s[rowIndex], t[0]);
              distanceCostMatrix[rowIndex][0] = cost + distanceCostMatrix[rowIndex - 1][0];
          }

          for (var columnIndex = 1; columnIndex < state.n; columnIndex++) {
              var cost = state.distance(s[0], t[columnIndex]);
              distanceCostMatrix[0][columnIndex] = cost + distanceCostMatrix[0][columnIndex - 1];
          }

          for (var rowIndex = 1; rowIndex < state.m; rowIndex++) {
              for (var columnIndex = 1; columnIndex < state.n; columnIndex++) {
                  var cost = state.distance(s[rowIndex], t[columnIndex]);
                  distanceCostMatrix[rowIndex][columnIndex] =
                      cost + Math.min(
                          distanceCostMatrix[rowIndex - 1][columnIndex],          // Insertion
                          distanceCostMatrix[rowIndex][columnIndex - 1],          // Deletion
                          distanceCostMatrix[rowIndex - 1][columnIndex - 1]);     // Match
              }
          }

          var end = new Date().getTime();
          var time = end - start;

          state.distanceCostMatrix = distanceCostMatrix;
          state.similarity = distanceCostMatrix[state.m - 1][state.n - 1];
          return state.similarity;
        }

        function createMatrix(m, n, value) {
          var matrix = [];
          for (var rowIndex = 0; rowIndex < m; rowIndex++) {
              matrix.push(createArray(n, value));
          }
          return matrix;
        }

        function createArray(length, value) {
          if (typeof length !== 'number') {
              throw new TypeError('Invalid length type');
          }

          if (typeof value === 'undefined') {
              throw new Error('Invalid value: expected a value to be provided');
          }

          var array = new Array(length);
          for (var index = 0; index < length; index++) {
              array[index] = value;
          }

          return array;
        }

       return {
            getAvg: function(data) {
                return calAvg(data);
            },
            getStd: function(data) {
                return calStd(data);
            },
            get1dev: function(data) {
                return cal1dev(data);
            },
            getSimilarity: function(ground, data) {
                return calDTW(ground, data);
            }
       };

}])

.factory('$socket',function(socketFactory){

    var ySocket = null;

    function mySocket() {
        var myIoSocket = io.connect('http://128.199.239.83:5000');

        ySocket = socketFactory({
            ioSocket: myIoSocket
        });

        return ySocket;
    }

	return {
        getSocket: function() {
            if(ySocket !== null)
                return ySocket;
            else
                return mySocket();
        }
    };
})

.filter('secondsToDateTime', [function() {
    return function(seconds) {
        return new Date(1970,0,1).setSeconds(seconds);
    };
}]);
